import AsyncStorage from '@react-native-async-storage/async-storage';
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





const PROCESSING_STEPS = [
  'Analyzing menu image…',
  'Extracting menu items…',
  'Translating content…',
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
  const { generateResponseWithImage, isReady: aiReady, initializeModel } = useChatAIContext();

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
          'Download the AI model (~1.5 GB) to enable menu scanning. You only need to do this once.',
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
        const imageUri = uri.startsWith('file://') ? uri : `file://${uri}`;

        // Step 1: Ensure VL model is initialized
        setProcessingMsg(PROCESSING_STEPS[1]);
        if (!aiReady) await initializeModel();

        // Step 2: Use vision model to extract and categorize menu items in one shot
        const vlPrompt =
          `You are a menu reader. Analyze this menu image and extract all food and drink items.\n` +
          `Return ONLY valid JSON in this exact format:\n` +
          `{"categories":[{"name":"Category Name","items":[{"name":"Item name","price":"price or null"}]}]}\n` +
          `Rules:\n` +
          `- Skip noise (addresses, hours, website URLs, decorative text)\n` +
          `- Group items under logical category names (e.g. Appetizers, Main Dishes, Drinks)\n` +
          `- Use "Menu" as category name if categories are unclear\n` +
          `- Output ONLY the JSON object, no other text`;

        const vlResponse = await generateResponseWithImage(imageUri, vlPrompt);

        // Parse VL model JSON response
        let parsedCategories: { name: string; items: { name: string; price?: string | null }[] }[] = [];
        try {
          const jsonMatch = vlResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('no JSON');
          const parsed = JSON.parse(jsonMatch[0]) as { categories?: unknown };
          if (Array.isArray(parsed.categories)) {
            parsedCategories = parsed.categories as typeof parsedCategories;
          }
        } catch {
          // Fallback: treat response lines as a single "Menu" category
          const lines = vlResponse.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 2);
          parsedCategories = [{ name: 'Menu', items: lines.map((l) => ({ name: l })) }];
        }

        if (parsedCategories.length === 0 || parsedCategories.every((c) => c.items.length === 0)) {
          setStep('capture');
          Alert.alert('No Menu Items', 'Could not identify menu items. Try a clearer, well-lit photo of the menu.');
          return;
        }

        // Step 3: Translate item names for display
        setProcessingMsg(PROCESSING_STEPS[2]);
        const sameLanguage = sourceLanguage.code === targetLanguage.code;

        const menuResult: MenuCategory[] = [];
        let itemIndex = 0;

        for (const cat of parsedCategories) {
          const translatedItems: ParsedMenuItem[] = [];
          for (const item of cat.items) {
            const originalName = item.name;
            let translatedName = originalName;

            if (!sameLanguage) {
              try {
                translatedName = await translate(originalName, sourceLanguage.code, targetLanguage.code);
              } catch {
                translatedName = originalName;
              }
            }

            translatedItems.push({
              id: `item-${itemIndex++}`,
              original: originalName,
              english: originalName,
              translated: translatedName,
              price: item.price ?? undefined,
              quantity: 0,
            });
          }
          if (translatedItems.length > 0) {
            menuResult.push({ name: cat.name, items: translatedItems });
          }
        }

        setProcessingMsg(PROCESSING_STEPS[3]);
        setCategories(menuResult);
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
      aiReady, initializeModel, generateResponseWithImage,
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

      {/* Icon */}
      <View style={[styles.heroIconWrap, { backgroundColor: isDark ? '#242424' : '#f0f0f0' }]}>
        <IconSymbol name="fork.knife" size={36} color={colors.tint} />
      </View>

      <ThemedText type="title" style={styles.heroTitle}>
        Menu Scanner
      </ThemedText>
      <ThemedText style={[styles.heroSubtitle, { color: colors.icon }]}>
        Point your camera at any menu for instant translation.
      </ThemedText>

      {/* Language selector */}
      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langChip, { borderColor: isDark ? '#2e2e2e' : '#e0e0e0', backgroundColor: isDark ? '#242424' : '#fff' }]}
          onPress={() => setShowSourcePicker(true)}>
          <ThemedText style={[styles.langChipText, { color: colors.text }]}>{sourceLanguage.name}</ThemedText>
          <IconSymbol name="chevron.down" size={12} color={colors.icon} />
        </TouchableOpacity>

        <IconSymbol name="arrow.right" size={16} color={colors.icon} />

        <TouchableOpacity
          style={[styles.langChip, { borderColor: isDark ? '#2e2e2e' : '#e0e0e0', backgroundColor: isDark ? '#242424' : '#fff' }]}
          onPress={() => setShowTargetPicker(true)}>
          <ThemedText style={[styles.langChipText, { color: colors.text }]}>{targetLanguage.name}</ThemedText>
          <IconSymbol name="chevron.down" size={12} color={colors.icon} />
        </TouchableOpacity>
      </View>

      {/* Scan CTA */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: colors.tint }]}
        onPress={() => scanMenu('camera')}
        activeOpacity={0.85}>
        <IconSymbol name="camera.fill" size={20} color={isDark ? '#000' : '#fff'} />
        <ThemedText style={[styles.primaryButtonText, { color: isDark ? '#000' : '#fff' }]}>Scan Menu</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: isDark ? '#2e2e2e' : '#e0e0e0', backgroundColor: isDark ? '#242424' : '#fff' }]}
        onPress={() => scanMenu('gallery')}
        activeOpacity={0.85}>
        <IconSymbol name="photo.on.rectangle" size={18} color={colors.icon} />
        <ThemedText style={[styles.secondaryButtonText, { color: colors.icon }]}>
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
              <ThemedText style={[styles.orderBadgeText, { color: isDark ? '#000' : '#fff' }]}>{totalItems}</ThemedText>
            </View>
            <ThemedText style={[styles.orderButtonText, { color: isDark ? '#000' : '#fff' }]}>View My Order</ThemedText>
            <IconSymbol name="chevron.right" size={18} color={isDark ? '#000' : '#fff'} />
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
  const onTint = isDark ? '#000' : '#fff';
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
              <ThemedText style={[styles.qtyBtnText, { color: onTint }]}>−</ThemedText>
            </TouchableOpacity>
            <ThemedText style={[styles.qtyValue, { color: colors.text }]}>{item.quantity}</ThemedText>
            <TouchableOpacity
              onPress={onIncrement}
              style={[styles.qtyBtn, { backgroundColor: colors.tint }]}>
              <ThemedText style={[styles.qtyBtnText, { color: onTint }]}>+</ThemedText>
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
  const onTint = isDark ? '#000' : '#fff';

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
                  <ThemedText style={[styles.orderQtyText, { color: onTint }]}>×{item.quantity}</ThemedText>
                </View>
              </View>
            ))}
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.tint, marginTop: 24 }]}
            onPress={onReset}
            activeOpacity={0.85}>
            <IconSymbol name="camera.fill" size={20} color={onTint} />
            <ThemedText style={[styles.primaryButtonText, { color: onTint }]}>Scan New Menu</ThemedText>
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
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  heroTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    width: '100%',
  },
  langChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  langChipText: {
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 50,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
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
