import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useTranslationContext } from '@/contexts/translation-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LANGUAGES } from '@/utils/language-preferences';

export default function CameraScreen() {
  const colorScheme = useColorScheme();
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [currentPage, setCurrentPage] = useState<'extract' | 'translate' | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const { translate, status, progress, error, targetLanguage, setTargetLanguage } = useTranslationContext();

  // Show error if model fails to load
  useEffect(() => {
    if (error) {
      Alert.alert('Model Error', error);
    }
  }, [error]);

  // Show loading state while model is initializing
  if (status === 'loading' || status === 'downloading') {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <ThemedText style={styles.message}>
          {status === 'downloading' ? 'Downloading translation model...' : 'Loading translation model...'}
        </ThemedText>
        {status === 'downloading' && (
          <ThemedText style={styles.progressText}>{progress}%</ThemedText>
        )}
      </ThemedView>
    );
  }

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ThemedText style={styles.message}>We need your permission to show the camera</ThemedText>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]} 
          onPress={requestPermission}
        >
          <ThemedText style={styles.buttonText}>Grant Permission</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  async function takePicture() {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        setCapturedImage(photo.uri);
        await processImage(photo.uri);
      }
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      await processImage(result.assets[0].uri);
    }
  }

  async function processImage(imageUri: string) {
    setIsExtracting(true);
    setExtractedText('');
    setTranslatedText('');
    
    try {
      // Import TextRecognition for OCR
      const TextRecognition = require('react-native-text-recognition').default;
      
      // Step 1: Extract text from image using OCR only
      console.log('Extracting text from image:', imageUri);
      const result = await TextRecognition.recognize(imageUri);
      
      // Convert result to string, handling all possible types
      let extractedText: string;
      
      if (Array.isArray(result)) {
        extractedText = result.join('\n');
      } else if (typeof result === 'string') {
        extractedText = result;
      } else if (result && typeof result === 'object' && 'text' in result) {
        extractedText = String(result.text);
      } else {
        extractedText = String(result || '');
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        setExtractedText('No text found in image');
      } else {
        setExtractedText(extractedText);
      }
      setCurrentPage('extract');
    } catch (error) {
      console.error('Error extracting text:', error);
      Alert.alert('Extraction Error', error instanceof Error ? error.message : 'Failed to extract text from image');
      setExtractedText('Error extracting text from image');
    } finally {
      setIsExtracting(false);
    }
  }

  async function translateText() {
    if (!extractedText || extractedText === 'No text found in image' || extractedText === 'Error extracting text from image') {
      Alert.alert('No Text', 'Please capture an image with text first');
      return;
    }

    setIsTranslating(true);
    setTranslatedText('');
    
    try {
      // Auto-detect source language - use 'en' as default
      const sourceLang = 'en';
      
      const result = await translate(
        extractedText,
        sourceLang,
        targetLanguage.code,
        (partial) => {
          setTranslatedText(partial);
        }
      );
      
      setTranslatedText(result);
      setCurrentPage('translate');
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Translation Error', error instanceof Error ? error.message : 'Failed to translate text');
    } finally {
      setIsTranslating(false);
    }
  }

  function retakePhoto() {
    setCapturedImage(null);
    setExtractedText('');
    setTranslatedText('');
    setIsExtracting(false);
    setIsTranslating(false);
    setCurrentPage(null);
  }

  const LanguagePicker = () => {
    if (!showLanguagePicker) return null;

    return (
      <View style={[styles.pickerOverlay, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <ScrollView style={styles.pickerScroll}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.pickerItem, { borderBottomColor: Colors[colorScheme ?? 'light'].icon + '30' }]}
              onPress={() => {
                setTargetLanguage(lang);
                setShowLanguagePicker(false);
              }}>
              <ThemedText style={styles.pickerItemText}>{lang.name}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.pickerClose} onPress={() => setShowLanguagePicker(false)}>
          <ThemedText style={{ color: Colors[colorScheme ?? 'light'].tint }}>Close</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  // Page 1: Extracted Text + Language Picker + Translate Button
  if (currentPage === 'extract') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]} edges={['top', 'left', 'right']}>
        <ScrollView style={styles.pageContainer}>
          <ThemedView style={styles.textSection}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Extracted Text:</ThemedText>
            {isExtracting ? (
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            ) : (
              <ThemedText style={styles.extractedText}>{extractedText}</ThemedText>
            )}
          </ThemedView>

          {extractedText && !isExtracting && extractedText !== 'No text found in image' && extractedText !== 'Error extracting text from image' && (
            <>
              <ThemedView style={styles.languageSection}>
                <ThemedText style={styles.languageLabel}>Translate to:</ThemedText>
                <TouchableOpacity
                  style={[styles.languageButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }]}
                  onPress={() => setShowLanguagePicker(true)}>
                  <ThemedText style={[styles.languageButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                    {targetLanguage.name}
                  </ThemedText>
                  <IconSymbol name="chevron.down" size={14} color={Colors[colorScheme ?? 'light'].tint} />
                </TouchableOpacity>
              </ThemedView>

              <TouchableOpacity 
                style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
                onPress={translateText}
                disabled={isTranslating}
              >
                {isTranslating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <IconSymbol size={24} name="arrow.left.arrow.right" color="#fff" />
                )}
                <ThemedText style={styles.buttonText}>
                  {isTranslating ? 'Translating...' : 'Translate'}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint, marginTop: 10 }]} 
            onPress={retakePhoto}
          >
            <IconSymbol size={24} name="camera.fill" color="#fff" />
            <ThemedText style={styles.buttonText}>Take Another Photo</ThemedText>
          </TouchableOpacity>
        </ScrollView>
        <LanguagePicker />
      </SafeAreaView>
    );
  }

  // Page 2: Translated Text + Take Another Photo Button
  if (currentPage === 'translate') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]} edges={['top', 'left', 'right']}>
        <ScrollView style={styles.pageContainer}>
          <ThemedView style={styles.textSection}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Translation:</ThemedText>
            <ThemedText style={styles.translatedText}>{translatedText}</ThemedText>
          </ThemedView>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]} 
            onPress={retakePhoto}
          >
            <IconSymbol size={24} name="camera.fill" color="#fff" />
            <ThemedText style={styles.buttonText}>Take Another Photo</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Camera View

  return (
    <ThemedView style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleCameraFacing}>
            <IconSymbol size={32} name="arrow.triangle.2.circlepath.camera" color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={pickImage}>
            <IconSymbol size={32} name="photo.on.rectangle" color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  camera: {
    flex: 1,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    marginTop: 16,
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  cameraControls: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  controlButton: {
    padding: 15,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(0, 0, 0, 0.3)',
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
  },
  pageContainer: {
    flex: 1,
    padding: 20,
  },
  textSection: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  sectionTitle: {
    marginBottom: 10,
  },
  extractedText: {
    fontSize: 16,
    lineHeight: 24,
  },
  translatedText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    gap: 10,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  languageSection: {
    marginBottom: 15,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  languageButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
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
});
