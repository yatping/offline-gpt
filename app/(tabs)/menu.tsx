import AsyncStorage from '@react-native-async-storage/async-storage';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguagePicker } from '@/components/language-picker';
import { PremiumLanguagesPaywall } from '@/components/premium-languages-paywall';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useChatAIContext } from '@/contexts/chat-ai-context';
import { useBannerVisible, useDownloadManager } from '@/contexts/download-manager-context';
import { useTranslationContext } from '@/contexts/translation-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LANGUAGES } from '@/utils/language-preferences';

const NEW_BADGE_KEY = '@menu/new_badge_dismissed';

type MenuStep = 'capture' | 'processing' | 'menu' | 'order';

interface ParsedMenuItem {
  id: string;
  original: string;   // OCR source text — shown to server
  english: string;    // English translation — used by AI categorizer
  translated: string; // Target language — shown to user when browsing
  price?: string;
  quantity: number;
}

interface MenuCategory {
  name: string;
  items: ParsedMenuItem[];
}

const PRICE_REGEX = /^[$¥€£₩₹฿]?\s*[\d,]+\.?\d*\s*[$¥€£₩₹฿]?$/;
const NOISE_REGEX = /^[\d\s\-–—|/\\.,;:!?@#%^&*()[\]{}<>+=_~`'"]+$/;
// Opening hours like "07:00–22:00", "9am-10pm", "07.00am - 10.00pm"
const HOURS_REGEX = /\b\d{1,2}[:.]\d{2}\s*(am|pm)?\s*[-–—]\s*\d{1,2}[:.]\d{2}\s*(am|pm)?\b/i;
// URLs and social handles
const URL_REGEX = /(@|www\.|\.com|\.net|\.org|http)/i;

/** Pick ML Kit OCR script based on source language code */
function getOCRScript(langCode: string): TextRecognitionScript {
  switch (langCode) {
    case 'zh': return TextRecognitionScript.CHINESE;
    case 'ja': return TextRecognitionScript.JAPANESE;
    case 'ko': return TextRecognitionScript.KOREAN;
    case 'hi': case 'mr': case 'ne': return TextRecognitionScript.DEVANAGARI;
    default: return TextRecognitionScript.LATIN;
  }
}

/** Parse raw OCR text into flat item candidates */
function extractRawItems(rawText: string): { original: string }[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: { original: string }[] = [];

  for (const line of lines) {
    if (line.length < 2) continue;
    if (NOISE_REGEX.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (HOURS_REGEX.test(line)) continue;
    if (URL_REGEX.test(line)) continue;
    if (PRICE_REGEX.test(line) && items.length > 0) continue;

    items.push({ original: line });
  }

  return items.slice(0, 50); // cap at 50 items for context window
}

/** Use Llama to filter noise, identify categories, and group items */
async function categorizeWithAI(
  items: ParsedMenuItem[],
  generateResponse: (msgs: { role: 'user' | 'assistant' | 'system'; content: string }[], cb?: (p: string) => void) => Promise<string>
): Promise<MenuCategory[]> {
  if (items.length === 0) return [];

  const itemList = items.map((item, i) => `${i}:${item.english}`).join('\n');

  const prompt =
    `Restaurant menu lines (index:text):\n${itemList}\n\nRules:\n1. SKIP noise: restaurant names, addresses, URLs, opening hours, page titles\n2. Lines that are section headers (like "Coffee Classics","Iced Coffee","Desserts") → use as category name, NOT as items\n3. Only include actual food/drink items under a category\n\nReturn ONLY JSON mapping category names to item index arrays.\nExample: {"Coffee":[5,6,7],"Tea":[11,12]}\nJSON:`;

  try {
    const response = await generateResponse([{ role: 'user', content: prompt }]);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no JSON');

    const categoryMap = JSON.parse(jsonMatch[0]) as Record<string, number[]>;
    const categories: MenuCategory[] = Object.entries(categoryMap)
      .filter(([, indices]) => Array.isArray(indices) && indices.length > 0)
      .map(([name, indices]) => ({
        name,
        items: indices
          .filter((i) => i >= 0 && i < items.length)
          .map((i) => ({ ...items[i] })),
      }))
      .filter((cat) => cat.items.length > 0);

    if (categories.length === 0) throw new Error('empty');
    return categories;
  } catch {
    // Fallback: single category, basic noise filtering
    const fallback = items.filter(
      (item) => !HOURS_REGEX.test(item.translated) && !URL_REGEX.test(item.translated)
    );
    return [{ name: 'Menu', items: fallback.length > 0 ? fallback : items }];
  }
}

const PROCESSING_STEPS = [
  'Scanning menu text…',
  'Recognizing items…',
  'Translating content…',
  'Categorizing with AI…',
  'Almost ready!',
];

export default function MenuScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const bannerVisible = useBannerVisible();
  const isDark = colorScheme === 'dark';

  const { translate, sourceLanguage, targetLanguage, setSourceLanguage, setTargetLanguage } =
    useTranslationContext();

  const { isModelDownloaded, downloadModel } = useDownloadManager();
  const { generateResponse, isReady: aiReady, initializeModel } = useChatAIContext();

  const [step, setStep] = useState<MenuStep>('capture');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [processingMsg, setProcessingMsg] = useState(PROCESSING_STEPS[0]);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const processingMsgIndex = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Check if "NEW" badge should show
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(NEW_BADGE_KEY).then((val) => {
        if (!val) setShowNewBadge(true);
      });
    }, [])
  );

  const dismissNewBadge = useCallback(async () => {
    setShowNewBadge(false);
    await AsyncStorage.setItem(NEW_BADGE_KEY, 'dismissed');
  }, []);

  // Pulse animation for processing step
  useEffect(() => {
    if (step === 'processing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();

      const msgInterval = setInterval(() => {
        processingMsgIndex.current = (processingMsgIndex.current + 1) % PROCESSING_STEPS.length;
        setProcessingMsg(PROCESSING_STEPS[processingMsgIndex.current]);
      }, 1600);

      return () => {
        pulse.stop();
        clearInterval(msgInterval);
      };
    }
  }, [step, pulseAnim]);

  // Fade-in animation for menu step
  useEffect(() => {
    if (step === 'menu') {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [step, fadeAnim]);

  const scanMenu = useCallback(
    async (source: 'camera' | 'gallery') => {
      // Prompt download if model not ready
      if (!isModelDownloaded('chat')) {
        Alert.alert(
          'AI Model Required',
          'Download the AI model (~1.3 GB) to enable menu scanning. You only need to do this once.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Download', onPress: () => downloadModel('chat') },
          ]
        );
        return;
      }

      try {
        let result: ImagePicker.ImagePickerResult;

        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed to scan menus.');
            return;
          }
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 1,
            allowsEditing: false,
          });
        } else {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            allowsEditing: false,
          });
        }

        if (result.canceled || !result.assets[0]) return;

        if (showNewBadge) dismissNewBadge();
        setStep('processing');
        processingMsgIndex.current = 0;
        setProcessingMsg(PROCESSING_STEPS[0]);

        const uri = result.assets[0].uri;

        // Step 1: OCR — extract individual lines from blocks (handles multi-column layouts)
        setProcessingMsg(PROCESSING_STEPS[1]);
        const ocrResult = await TextRecognition.recognize(uri, getOCRScript(sourceLanguage.code));

        // Use block→line structure so each text line is a separate string (avoids column merging)
        const ocrLines: string[] = [];
        for (const block of ocrResult.blocks ?? []) {
          for (const line of block.lines ?? []) {
            const t = line.text?.trim();
            if (t) ocrLines.push(t);
          }
        }
        // Fallback: split the full text if blocks had no lines
        if (ocrLines.length === 0) {
          ocrLines.push(...(ocrResult.text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
        }

        if (ocrLines.length === 0) {
          setStep('capture');
          Alert.alert('No Text Found', 'Could not detect any text in the image. Try a clearer, well-lit photo.');
          return;
        }

        // Step 2: Extract raw item candidates
        const rawItems = extractRawItems(ocrLines.join('\n'));
        if (rawItems.length === 0) {
          setStep('capture');
          Alert.alert('No Menu Items', 'Could not identify menu items. Try a clearer photo of the menu.');
          return;
        }

        // Step 3: Translate each item — first to English (for AI), then to target language (for display)
        setProcessingMsg(PROCESSING_STEPS[2]);
        const sourceIsEnglish = sourceLanguage.code === 'en';
        const targetIsEnglish = targetLanguage.code === 'en';
        const sameLanguage = sourceLanguage.code === targetLanguage.code;

        // Build English labels (used by AI categorizer)
        const englishTexts: string[] = [];
        for (const item of rawItems) {
          if (sourceIsEnglish) {
            englishTexts.push(item.original);
          } else {
            try {
              const en = await translate(item.original, sourceLanguage.code, 'en');
              englishTexts.push(en?.trim() || item.original);
            } catch {
              englishTexts.push(item.original);
            }
          }
        }

        // Build target language labels (shown to user)
        const translatedTexts: string[] = [];
        for (let i = 0; i < rawItems.length; i++) {
          if (sameLanguage) {
            translatedTexts.push(rawItems[i].original);
          } else if (targetIsEnglish) {
            translatedTexts.push(englishTexts[i]); // reuse — no extra call needed
          } else {
            try {
              const t = await translate(rawItems[i].original, sourceLanguage.code, targetLanguage.code);
              translatedTexts.push(t?.trim() || rawItems[i].original);
            } catch {
              translatedTexts.push(rawItems[i].original);
            }
          }
        }

        const flatItems: ParsedMenuItem[] = rawItems.map((r, i) => ({
          id: `item-${i}`,
          original: r.original,
          english: englishTexts[i],
          translated: translatedTexts[i],
          quantity: 0,
        }));

        // Step 4: AI categorization (model already initialized globally)
        setProcessingMsg(PROCESSING_STEPS[3]);
        if (!aiReady) {
          // Model still loading — wait briefly then try
          await initializeModel();
        }
        const parsed = await categorizeWithAI(flatItems, generateResponse);

        setCategories(parsed);
        setStep('menu');
      } catch (err) {
        setStep('capture');
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to scan menu. Please try again.');
      }
    },
    [
      isModelDownloaded, downloadModel, translate,
      sourceLanguage.code, targetLanguage.code,
      showNewBadge, dismissNewBadge,
      aiReady, initializeModel, generateResponse,
    ]
  );

  const updateQuantity = useCallback((categoryIndex: number, itemId: string, delta: number) => {
    setCategories((prev) =>
      prev.map((cat, ci) =>
        ci === categoryIndex
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
              ),
            }
          : cat
      )
    );
  }, []);

  const allItems = categories.flatMap((cat) => cat.items);
  const selectedItems = allItems.filter((item) => item.quantity > 0);
  const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const reset = useCallback(() => {
    setCategories([]);
    setStep('capture');
    setShowOrderModal(false);
  }, []);

  // ─── Render: Capture ────────────────────────────────────────────────────────

  const renderCapture = () => (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.captureContainer}
      keyboardShouldPersistTaps="handled">
      {/* Hero */}
      <View style={[styles.heroBadge, { backgroundColor: colors.tint + '18' }]}>
        <ThemedText style={[styles.heroBadgeText, { color: colors.tint }]}>
          ✨ AI-Powered Menu Translation
        </ThemedText>
      </View>

      <View style={[styles.heroIconWrap, { backgroundColor: colors.tint + '18' }]}>
        <IconSymbol name="fork.knife" size={64} color={colors.tint} />
      </View>

      <ThemedText type="title" style={styles.heroTitle}>
        Menu Scanner
      </ThemedText>
      <ThemedText style={[styles.heroSubtitle, { color: colors.icon }]}>
        Point your camera at any menu and instantly see it translated. Tap items to build your order,
        then show the original-language card to your server.
      </ThemedText>

      {/* Language selector */}
      <ThemedView style={[styles.langCard, { borderColor: colors.icon + '30', backgroundColor: isDark ? '#1f2022' : '#fff' }]}>
        <ThemedText style={[styles.langCardLabel, { color: colors.icon }]}>Translate from</ThemedText>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langChip, { borderColor: colors.tint, backgroundColor: colors.tint + '15' }]}
            onPress={() => setShowSourcePicker(true)}>
            <ThemedText style={[styles.langChipText, { color: colors.tint }]}>{sourceLanguage.name}</ThemedText>
            <IconSymbol name="chevron.down" size={14} color={colors.tint} />
          </TouchableOpacity>

          <IconSymbol name="arrow.right" size={18} color={colors.icon} />

          <TouchableOpacity
            style={[styles.langChip, { borderColor: colors.tint, backgroundColor: colors.tint + '15' }]}
            onPress={() => setShowTargetPicker(true)}>
            <ThemedText style={[styles.langChipText, { color: colors.tint }]}>{targetLanguage.name}</ThemedText>
            <IconSymbol name="chevron.down" size={14} color={colors.tint} />
          </TouchableOpacity>
        </View>
      </ThemedView>

      {/* Scan CTA */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.tint }]}
        onPress={() => scanMenu('camera')}
        activeOpacity={0.85}>
        <IconSymbol name="camera.fill" size={24} color="#fff" />
        <ThemedText style={styles.primaryButtonText}>Scan Menu</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: colors.tint }]}
        onPress={() => scanMenu('gallery')}
        activeOpacity={0.85}>
        <IconSymbol name="photo.on.rectangle" size={20} color={colors.tint} />
        <ThemedText style={[styles.secondaryButtonText, { color: colors.tint }]}>
          Choose from Gallery
        </ThemedText>
      </TouchableOpacity>

      <LanguagePicker
        visible={showSourcePicker}
        selectedLanguage={sourceLanguage}
        languages={LANGUAGES}
        onSelect={setSourceLanguage}
        onClose={() => setShowSourcePicker(false)}
        onShowPaywall={() => { setShowSourcePicker(false); setShowPaywall(true); }}
      />
      <LanguagePicker
        visible={showTargetPicker}
        selectedLanguage={targetLanguage}
        languages={LANGUAGES}
        onSelect={setTargetLanguage}
        onClose={() => setShowTargetPicker(false)}
        onShowPaywall={() => { setShowTargetPicker(false); setShowPaywall(true); }}
      />
      <PremiumLanguagesPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseComplete={() => setShowPaywall(false)}
      />
    </ScrollView>
  );

  // ─── Render: Processing ─────────────────────────────────────────────────────

  const renderProcessing = () => (
    <View style={[styles.processingContainer, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.processingIconWrap, { backgroundColor: colors.tint + '22', transform: [{ scale: pulseAnim }] }]}>
        <IconSymbol name="fork.knife" size={56} color={colors.tint} />
      </Animated.View>
      <ThemedText style={[styles.processingMsg, { color: colors.text }]}>{processingMsg}</ThemedText>
      <ThemedText style={[styles.processingSubMsg, { color: colors.icon }]}>
        This may take a moment
      </ThemedText>
    </View>
  );

  // ─── Render: Menu items ─────────────────────────────────────────────────────

  const renderMenu = () => (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.menuHeader, { borderBottomColor: colors.icon + '20', backgroundColor: isDark ? '#1a1b1c' : '#fff' }]}>
        <TouchableOpacity onPress={reset} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={22} color={colors.tint} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={styles.menuHeaderTitle}>
          {targetLanguage.name} Menu
        </ThemedText>
        <ThemedText style={[styles.menuHeaderSub, { color: colors.icon }]}>
          {allItems.length} items · {sourceLanguage.name} → {targetLanguage.name}
        </ThemedText>
      </View>

      <Animated.ScrollView style={{ flex: 1, opacity: fadeAnim }} contentContainerStyle={styles.menuList}>
        {categories.map((category, catIndex) => (
          <View key={category.name}>
            {/* Category header */}
            <View style={styles.categoryHeader}>
              <ThemedText style={[styles.categoryTitle, { color: colors.tint }]}>
                {category.name}
              </ThemedText>
              <View style={[styles.categoryLine, { backgroundColor: colors.tint + '30' }]} />
            </View>

            {category.items.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                colors={colors}
                isDark={isDark}
                onIncrement={() => updateQuantity(catIndex, item.id, 1)}
                onDecrement={() => updateQuantity(catIndex, item.id, -1)}
              />
            ))}
          </View>
        ))}
        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      {/* Floating order button */}
      {totalItems > 0 && (
        <View style={[styles.floatingBar, { backgroundColor: isDark ? '#1a1b1c' : '#fff', borderTopColor: colors.icon + '20' }]}>
          <TouchableOpacity
            style={[styles.orderButton, { backgroundColor: colors.tint }]}
            onPress={() => setShowOrderModal(true)}
            activeOpacity={0.85}>
            <View style={styles.orderBadge}>
              <ThemedText style={styles.orderBadgeText}>{totalItems}</ThemedText>
            </View>
            <ThemedText style={styles.orderButtonText}>View My Order</ThemedText>
            <IconSymbol name="chevron.right" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Order modal */}
      <OrderModal
        visible={showOrderModal}
        items={selectedItems}
        sourceLanguage={sourceLanguage.name}
        targetLanguage={targetLanguage.name}
        colors={colors}
        isDark={isDark}
        onClose={() => setShowOrderModal(false)}
        onReset={reset}
      />
    </View>
  );

  // ─── Root render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={bannerVisible ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}>
      {step === 'capture' && renderCapture()}
      {step === 'processing' && renderProcessing()}
      {step === 'menu' && renderMenu()}
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MenuItemCard({
  item,
  colors,
  isDark,
  onIncrement,
  onDecrement,
}: {
  item: ParsedMenuItem;
  colors: (typeof Colors)['light'];
  isDark: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const isSelected = item.quantity > 0;
  return (
    <Pressable
      onPress={onIncrement}
      style={[
        styles.itemCard,
        {
          backgroundColor: isSelected
            ? (isDark ? colors.tint + '22' : colors.tint + '10')
            : isDark ? '#1f2022' : '#fff',
          borderColor: isSelected ? colors.tint : (isDark ? '#2c2c2e' : '#e5e5ea'),
        },
      ]}>
      <View style={styles.itemCardBody}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.itemTranslated, { color: isSelected ? colors.tint : colors.text }]}>
            {item.translated}
          </ThemedText>
          <ThemedText style={[styles.itemOriginal, { color: colors.icon }]}>{item.original}</ThemedText>
          {item.price && (
            <ThemedText style={[styles.itemPrice, { color: isSelected ? colors.tint : colors.icon }]}>
              {item.price}
            </ThemedText>
          )}
        </View>

        {isSelected ? (
          <View style={styles.qtyControl}>
            <TouchableOpacity
              onPress={onDecrement}
              style={[styles.qtyBtn, { backgroundColor: colors.tint }]}>
              <ThemedText style={styles.qtyBtnText}>−</ThemedText>
            </TouchableOpacity>
            <ThemedText style={[styles.qtyValue, { color: colors.text }]}>{item.quantity}</ThemedText>
            <TouchableOpacity
              onPress={onIncrement}
              style={[styles.qtyBtn, { backgroundColor: colors.tint }]}>
              <ThemedText style={styles.qtyBtnText}>+</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.addBtn, { borderColor: colors.tint }]}>
            <ThemedText style={[styles.addBtnText, { color: colors.tint }]}>+</ThemedText>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function OrderModal({
  visible,
  items,
  sourceLanguage,
  targetLanguage,
  colors,
  isDark,
  onClose,
  onReset,
}: {
  visible: boolean;
  items: ParsedMenuItem[];
  sourceLanguage: string;
  targetLanguage: string;
  colors: (typeof Colors)['light'];
  isDark: boolean;
  onClose: () => void;
  onReset: () => void;
}) {
  const sameLanguage = sourceLanguage === targetLanguage;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: isDark ? '#151718' : '#f2f2f6' }]}>
        {/* Modal header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.icon + '20', backgroundColor: isDark ? '#1a1b1c' : '#fff' }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <IconSymbol name="chevron.down" size={22} color={colors.icon} />
          </TouchableOpacity>
          <ThemedText type="subtitle" style={{ textAlign: 'center', flex: 1 }}>
            My Order
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          {/* Instruction */}
          <View style={[styles.instructionCard, { backgroundColor: colors.tint + '15', borderColor: colors.tint + '40' }]}>
            <IconSymbol name="info.circle.fill" size={18} color={colors.tint} />
            <ThemedText style={[styles.instructionText, { color: colors.tint }]}>
              Show the card below to your server to place your order in {sourceLanguage}.
            </ThemedText>
          </View>

          {/* Order card — source language (for server) */}
          <View style={[styles.orderCard, { backgroundColor: isDark ? '#1f2022' : '#fff', borderColor: colors.icon + '20' }]}>
            <View style={[styles.orderCardHeader, { borderBottomColor: colors.icon + '15' }]}>
              <IconSymbol name="fork.knife" size={18} color={colors.tint} />
              <ThemedText style={[styles.orderCardTitle, { color: colors.tint }]}>
                For your server ({sourceLanguage})
              </ThemedText>
            </View>

            {items.map((item) => (
              <View key={item.id} style={[styles.orderRow, { borderBottomColor: colors.icon + '10' }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.orderItemOriginal, { color: colors.text }]}>
                    {item.original}
                  </ThemedText>
                  {!sameLanguage && (
                    <ThemedText style={[styles.orderItemTranslated, { color: colors.icon }]}>
                      {item.translated}
                    </ThemedText>
                  )}
                  {item.price && (
                    <ThemedText style={[styles.orderItemPrice, { color: colors.icon }]}>
                      {item.price}
                    </ThemedText>
                  )}
                </View>
                <View style={[styles.orderQtyBadge, { backgroundColor: colors.tint }]}>
                  <ThemedText style={styles.orderQtyText}>×{item.quantity}</ThemedText>
                </View>
              </View>
            ))}
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.tint, marginTop: 24 }]}
            onPress={onReset}
            activeOpacity={0.85}>
            <IconSymbol name="camera.fill" size={20} color="#fff" />
            <ThemedText style={styles.primaryButtonText}>Scan New Menu</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.tint, marginTop: 12 }]}
            onPress={onClose}
            activeOpacity={0.85}>
            <ThemedText style={[styles.secondaryButtonText, { color: colors.tint }]}>Back to Menu</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Capture
  captureContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  heroIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    textAlign: 'center',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  langCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  langCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  langChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Model download styles
  modelReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 20,
  },
  modelReadyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modelDownloadCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  modelDownloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modelDownloadTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modelDownloadSub: {
    fontSize: 13,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  cancelDownloadBtn: {
    alignSelf: 'flex-end',
  },
  cancelDownloadText: {
    fontSize: 13,
    fontWeight: '500',
  },
  downloadBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // Category styles
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    gap: 10,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  categoryLine: {
    flex: 1,
    height: 1,
  },
  primaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  howCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  howTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  howIcon: {
    width: 20,
  },
  howText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },

  // Processing
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  processingIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingMsg: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  processingSubMsg: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },

  // Menu
  menuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    marginBottom: 2,
  },
  menuHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  menuHeaderSub: {
    fontSize: 13,
    marginTop: 2,
  },
  menuList: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  itemCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemTranslated: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  itemOriginal: {
    fontSize: 13,
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '300',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 22,
    textAlign: 'center',
  },
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 8 },
    }),
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  orderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  // Order Modal
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalClose: {
    width: 40,
    alignItems: 'flex-start',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    fontWeight: '500',
  },
  orderCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
    }),
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orderCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  orderItemOriginal: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderItemTranslated: {
    fontSize: 13,
    marginTop: 2,
    fontStyle: 'italic',
  },
  orderItemPrice: {
    fontSize: 13,
    marginTop: 2,
  },
  orderQtyBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  orderQtyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
