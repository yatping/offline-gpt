import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useTranslationContext } from '@/contexts/translation-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LANGUAGES } from '@/utils/language-preferences';

export default function TranslateScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const {
    status,
    error,
    translate,
    isReady,
    isTranslating,
    sourceLanguage,
    targetLanguage,
    setSourceLanguage,
    setTargetLanguage,
  } = useTranslationContext();

  // Translate when source text changes (with debounce)
  useEffect(() => {
    if (!isReady || !sourceText.trim()) {
      if (!sourceText.trim()) {
        setTranslatedText('');
      }
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        await translate(
          sourceText,
          sourceLanguage.code,
          targetLanguage.code,
          (partial) => {
            setTranslatedText(partial);
          }
        );
      } catch (err) {
        console.error('Translation failed:', err);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sourceText, sourceLanguage.code, targetLanguage.code, isReady, translate]);

  const swapLanguages = useCallback(() => {
    const tempLang = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(tempLang);
    const tempText = sourceText;
    setSourceText(translatedText);
    setTranslatedText(tempText);
  }, [sourceLanguage, targetLanguage, sourceText, translatedText]);

  const LanguagePicker = ({
    visible,
    onSelect,
    onClose,
  }: {
    visible: boolean;
    onSelect: (lang: typeof LANGUAGES[0]) => void;
    onClose: () => void;
  }) => {
    if (!visible) return null;

    return (
      <View style={[styles.pickerOverlay, { backgroundColor: colors.background }]} onTouchEnd={onClose}>
        <ScrollView style={styles.pickerScroll}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.pickerItem, { borderBottomColor: colors.icon + '30' }]}
              onPress={() => {
                onSelect(lang);
                onClose();
              }}>
              <ThemedText style={styles.pickerItemText}>{lang.name}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.pickerClose} onPress={onClose}>
          <ThemedText style={{ color: colors.tint }}>Close</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title">Translate</ThemedText>
          {error && (
            <ThemedText style={[styles.errorText, { color: '#ff4444' }]}>
              {error}
            </ThemedText>
          )}
        </View>

      {/* Source Section (Upper) */}
      <ThemedView style={[styles.section, { borderColor: colors.icon + '30', backgroundColor: '#fff' }]}>
        <TouchableOpacity
          style={styles.languageSelector}
          onPress={() => {
            Keyboard.dismiss();
            setShowSourcePicker(true);
          }}>
          <ThemedText style={[styles.languageText, { color: colors.tint }]}>
            {sourceLanguage.name}
          </ThemedText>
          <IconSymbol name="chevron.down" size={16} color={colors.tint} />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.text,
              backgroundColor: '#fff',
            },
          ]}
          placeholder="Enter text to translate..."
          placeholderTextColor={colors.icon}
          multiline
          value={sourceText}
          onChangeText={setSourceText}
          textAlignVertical="top"
        />

        {sourceText.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSourceText('');
              setTranslatedText('');
            }}>
            <IconSymbol name="xmark.circle.fill" size={20} color={colors.icon} />
          </TouchableOpacity>
        )}
      </ThemedView>

      {/* Swap Button */}
      <View style={styles.swapContainer}>
        <TouchableOpacity
          style={[styles.swapButton, { backgroundColor: colors.tint }]}
          onPress={swapLanguages}>
          <IconSymbol name="arrow.up.arrow.down" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Target Section (Lower) */}
      <ThemedView style={[styles.section, styles.targetSection, { borderColor: colors.icon + '30', backgroundColor: '#fff' }]}>
        <TouchableOpacity
          style={styles.languageSelector}
          onPress={() => {
            Keyboard.dismiss();
            setShowTargetPicker(true);
          }}>
          <ThemedText style={[styles.languageText, { color: colors.tint }]}>
            {targetLanguage.name}
          </ThemedText>
          <IconSymbol name="chevron.down" size={16} color={colors.tint} />
        </TouchableOpacity>

        <ScrollView style={styles.translatedTextContainer}>
          {isTranslating && !translatedText && (
            <View style={styles.translatingIndicator}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.translatedText, { marginLeft: 8 }]}>
                Translating...
              </ThemedText>
            </View>
          )}
          <ThemedText style={[styles.translatedText, !translatedText && { opacity: 0.5 }]}>
            {translatedText || (isReady ? 'Translation will appear here...' : 'Loading model...')}
          </ThemedText>
        </ScrollView>

        {translatedText.length > 0 && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <IconSymbol name="doc.on.doc" size={20} color={colors.tint} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <IconSymbol name="speaker.wave.2" size={20} color={colors.tint} />
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>

      {/* Language Pickers */}
      <LanguagePicker
        visible={showSourcePicker}
        onSelect={setSourceLanguage}
        onClose={() => setShowSourcePicker(false)}
      />
      <LanguagePicker
        visible={showTargetPicker}
        onSelect={setTargetLanguage}
        onClose={() => setShowTargetPicker(false)}
      />
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
  },
  targetSection: {
    backgroundColor: 'transparent',
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  languageText: {
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    padding: 0,
  },
  translatedTextContainer: {
    flex: 1,
  },
  translatedText: {
    fontSize: 18,
    lineHeight: 26,
    opacity: 0.8,
  },
  clearButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  swapContainer: {
    alignItems: 'center',
    marginVertical: -20,
    zIndex: 10,
  },
  swapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  actionButton: {
    padding: 8,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    paddingTop: 60,
  },
  pickerScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pickerItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 18,
  },
  pickerClose: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
  },
  translatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
});
