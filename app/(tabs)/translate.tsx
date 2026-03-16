import { useFocusEffect } from '@react-navigation/native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DownloadPromptModal } from '@/components/download-prompt-modal';
import { LanguagePicker } from '@/components/language-picker';
import { PremiumLanguagesPaywall } from '@/components/premium-languages-paywall';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useTranslationContext } from '@/contexts/translation-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LANGUAGES } from '@/utils/language-preferences';

type TranslateMode = 'translate' | 'camera' | 'conversation';

type Message = {
  id: string;
  text: string;
  timestamp: Date;
  speaker: 'upper' | 'lower';
  isOriginal: boolean;
};

export default function TranslateScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [mode, setMode] = useState<TranslateMode>('translate');
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);

  // Text Translation State
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Camera State
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [cameraTranslatedText, setCameraTranslatedText] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCameraTranslating, setIsCameraTranslating] = useState(false);
  const [currentPage, setCurrentPage] = useState<'extract' | 'translate' | null>(null);
  const [showCameraLanguagePicker, setShowCameraLanguagePicker] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Conversation State
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [isRecordingUpper, setIsRecordingUpper] = useState(false);
  const [showUpperLanguagePicker, setShowUpperLanguagePicker] = useState(false);
  const [currentUpperTranscript, setCurrentUpperTranscript] = useState('');
  const [pendingUpperText, setPendingUpperText] = useState('');
  const [isRecordingLower, setIsRecordingLower] = useState(false);
  const [showLowerLanguagePicker, setShowLowerLanguagePicker] = useState(false);
  const [currentLowerTranscript, setCurrentLowerTranscript] = useState('');
  const [pendingLowerText, setPendingLowerText] = useState('');

  const {
    status,
    error,
    progress,
    translate,
    isReady,
    isTranslating,
    sourceLanguage,
    targetLanguage,
    setSourceLanguage,
    setTargetLanguage,
    myLanguage: lowerLanguage,
    opponentLanguage: upperLanguage,
    setMyLanguage: setLowerLanguage,
    setOpponentLanguage: setUpperLanguage,
    initializeModel,
    releaseModel,
  } = useTranslationContext();

  const hasInitializedRef = useRef(false);

  // Initialize model when screen is focused, release when unfocused
  useFocusEffect(
    useCallback(() => {
      // Screen is focused - show download prompt if model not ready
      if (!hasInitializedRef.current && status === 'idle') {
        hasInitializedRef.current = true;
        setShowDownloadPrompt(true);
      }

      // Cleanup when screen loses focus
      return () => {
        hasInitializedRef.current = false;
        releaseModel();
      };
    }, [])
  );

  // Request speech permissions on mount
  useEffect(() => {
    const requestPermissions = async () => {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    };
    requestPermissions();
  }, []);

  // Text Translation Effect
  useEffect(() => {
    if (mode !== 'translate' || !isReady || !sourceText.trim()) {
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
        // Translation failed silently
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sourceText, sourceLanguage.code, targetLanguage.code, isReady, translate, mode]);

  // Speech Recognition Events
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript || '';
    const isFinal = event.isFinal;

    if (isRecordingUpper) {
      setCurrentUpperTranscript(transcript);
      if (isFinal) {
        setPendingUpperText(transcript);
      }
    } else if (isRecordingLower) {
      setCurrentLowerTranscript(transcript);
      if (isFinal) {
        setPendingLowerText(transcript);
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'network') {
      Alert.alert(
        'Speech Recognition Issue',
        'English speech recognition is having trouble. Please check:\n\n1. Go to Settings > General > Keyboard > Enable Dictation\n2. Go to Settings > Siri & Search > Enable "Listen for Hey Siri"\n3. Try restarting your device\n\nNote: Spanish and Chinese should still work fine.',
        [{ text: 'OK' }]
      );
    }
    
    setIsRecordingUpper(false);
    setIsRecordingLower(false);
  });

  // Text Translation Functions
  const swapLanguages = useCallback(() => {
    const tempLang = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(tempLang);
    const tempText = sourceText;
    setSourceText(translatedText);
    setTranslatedText(tempText);
  }, [sourceLanguage, targetLanguage, sourceText, translatedText]);

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Text copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy text');
    }
  };

  // Camera Functions
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
    setCameraTranslatedText('');
    
    try {
      const TextRecognition = require('react-native-text-recognition').default;
      
      const result = await TextRecognition.recognize(imageUri);
      
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
      Alert.alert('Extraction Error', error instanceof Error ? error.message : 'Failed to extract text from image');
      setExtractedText('Error extracting text from image');
    } finally {
      setIsExtracting(false);
    }
  }

  async function translateCameraText() {
    if (!extractedText || extractedText === 'No text found in image' || extractedText === 'Error extracting text from image') {
      Alert.alert('No Text', 'Please capture an image with text first');
      return;
    }

    setIsCameraTranslating(true);
    setCameraTranslatedText('');
    
    try {
      const sourceLang = 'en';
      
      const result = await translate(
        extractedText,
        sourceLang,
        targetLanguage.code,
        (partial) => {
          setCameraTranslatedText(partial);
        }
      );
      
      setCameraTranslatedText(result);
      setCurrentPage('translate');
    } catch (error) {
      Alert.alert('Translation Error', error instanceof Error ? error.message : 'Failed to translate text');
    } finally {
      setIsCameraTranslating(false);
    }
  }

  function retakePhoto() {
    setCapturedImage(null);
    setExtractedText('');
    setCameraTranslatedText('');
    setIsExtracting(false);
    setIsCameraTranslating(false);
    setCurrentPage(null);
  }

  // Conversation Functions
  const addOriginalMessage = (section: 'upper' | 'lower', text: string) => {
    if (!text.trim()) return;

    const speaker = section === 'upper' ? 'upper' : 'lower';
    
    const originalMessage: Message = {
      id: Date.now().toString(),
      text,
      timestamp: new Date(),
      speaker: speaker,
      isOriginal: true,
    };
    setAllMessages((prev) => [...prev, originalMessage]);
  };

  const translateAndAddMessage = async (section: 'upper' | 'lower', text: string) => {
    if (!text.trim()) return;

    const speaker = section === 'upper' ? 'upper' : 'lower';
    const oppositeSpeaker = section === 'upper' ? 'lower' : 'upper';

    if (!isReady) {
      return;
    }

    try {
      const sourceLanguage = section === 'upper' ? upperLanguage.code : lowerLanguage.code;
      const targetLanguage = section === 'upper' ? lowerLanguage.code : upperLanguage.code;

      const translatedText = await translate(text, sourceLanguage, targetLanguage);
      
      const translatedMessage: Message = {
        id: `${Date.now()}-translated`,
        text: translatedText,
        timestamp: new Date(),
        speaker: oppositeSpeaker,
        isOriginal: false,
      };
      setAllMessages((prev) => [...prev, translatedMessage]);
    } catch (error) {
      Alert.alert('Translation Error', 'Failed to translate message');
    }
  };

  const handleRecordPress = async (section: 'upper' | 'lower') => {
    try {
      if (section === 'upper') {
        if (isRecordingUpper) {
          await ExpoSpeechRecognitionModule.stop();
          setIsRecordingUpper(false);
          
          const textToTranslate = pendingUpperText || currentUpperTranscript;
          
          if (textToTranslate) {
            addOriginalMessage('upper', textToTranslate);
            await translateAndAddMessage('upper', textToTranslate);
            setPendingUpperText('');
            setCurrentUpperTranscript('');
          }
        } else {
          await ExpoSpeechRecognitionModule.start({
            lang: upperLanguage.speechCode,
            interimResults: true,
            maxAlternatives: 1,
            continuous: false,
            requiresOnDeviceRecognition: false,
            addsPunctuation: false,
            contextualStrings: [],
          });
          setIsRecordingUpper(true);
        }
      } else {
        if (isRecordingLower) {
          await ExpoSpeechRecognitionModule.stop();
          setIsRecordingLower(false);
          
          const textToTranslate = pendingLowerText || currentLowerTranscript;
          
          if (textToTranslate) {
            addOriginalMessage('lower', textToTranslate);
            await translateAndAddMessage('lower', textToTranslate);
            setPendingLowerText('');
            setCurrentLowerTranscript('');
          }
        } else {
          await ExpoSpeechRecognitionModule.start({
            lang: lowerLanguage.speechCode,
            interimResults: true,
            maxAlternatives: 1,
            continuous: false,
            requiresOnDeviceRecognition: false,
            addsPunctuation: false,
            contextualStrings: [],
          });
          setIsRecordingLower(true);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start speech recognition');
      setIsRecordingUpper(false);
      setIsRecordingLower(false);
    }
  };

  const getModeTitle = (mode: TranslateMode) => {
    switch (mode) {
      case 'translate':
        return 'Translate';
      case 'camera':
        return 'Camera';
      case 'conversation':
        return 'Conversation';
    }
  };

  const getModeIcon = (mode: TranslateMode) => {
    switch (mode) {
      case 'translate':
        return 'character.bubble.fill';
      case 'camera':
        return 'camera.fill';
      case 'conversation':
        return 'bubble.left.and.bubble.right.fill';
    }
  };



  // Bottom Tab Bar Component
  const BottomTabBar = () => (
    <View style={[styles.bottomTabBar, { backgroundColor: colors.background, borderTopColor: colors.icon + '30' }]}>
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => setMode('translate')}>
        <IconSymbol 
          name={getModeIcon('translate')} 
          size={24} 
          color={mode === 'translate' ? colors.tint : colors.icon} 
        />
        <ThemedText style={[
          styles.tabButtonText,
          { color: mode === 'translate' ? colors.tint : colors.icon }
        ]}>
          {getModeTitle('translate')}
        </ThemedText>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => setMode('camera')}>
        <IconSymbol 
          name={getModeIcon('camera')} 
          size={24} 
          color={mode === 'camera' ? colors.tint : colors.icon} 
        />
        <ThemedText style={[
          styles.tabButtonText,
          { color: mode === 'camera' ? colors.tint : colors.icon }
        ]}>
          {getModeTitle('camera')}
        </ThemedText>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => setMode('conversation')}>
        <IconSymbol 
          name={getModeIcon('conversation')} 
          size={24} 
          color={mode === 'conversation' ? colors.tint : colors.icon} 
        />
        <ThemedText style={[
          styles.tabButtonText,
          { color: mode === 'conversation' ? colors.tint : colors.icon }
        ]}>
          {getModeTitle('conversation')}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );

  // Render Text Translation Mode
  const renderTextTranslateMode = () => {
    if (status === 'loading' || status === 'downloading') {
      return (
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>
            {status === 'downloading' 
              ? `Downloading Translation AI Model... ${progress}%` 
              : 'Loading Translation AI Model...'}
          </ThemedText>
          {status === 'downloading' && (
            <View style={[styles.progressBar, { backgroundColor: colors.icon + '20' }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: colors.tint,
                    width: `${progress}%`
                  }
                ]} 
              />
            </View>
          )}
          <ThemedText style={[styles.loadingSubtext, { color: colors.icon }]}>
            {status === 'downloading'
              ? "This may take a few minutes. Please don't close the app."
              : 'This may take a few seconds'}
          </ThemedText>
        </View>
      );
    }

    return (
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {error && (
          <ThemedText style={[styles.errorText, { color: '#ff4444' }]}>
            {error}
          </ThemedText>
        )}

        <ThemedView style={[styles.section, { borderColor: colors.icon + '30', backgroundColor: colorScheme === 'dark' ? '#1f2022' : '#fff' }]}>
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
                backgroundColor: colorScheme === 'dark' ? '#1f2022' : '#fff',
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

        <View style={styles.swapContainer}>
          <TouchableOpacity
            style={[styles.swapButton, { backgroundColor: colors.tint }]}
            onPress={swapLanguages}>
            <IconSymbol name="arrow.up.arrow.down" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <ThemedView style={[styles.section, styles.targetSection, { borderColor: colors.icon + '30', backgroundColor: colorScheme === 'dark' ? '#1f2022' : '#fff' }]}>
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
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => copyToClipboard(translatedText)}
              >
                <IconSymbol name="doc.on.doc" size={20} color={colors.tint} />
              </TouchableOpacity>
              {/* <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => speakText(translatedText, targetLanguage.code)}
              >
                <IconSymbol name="speaker.wave.2" size={20} color={colors.tint} />
              </TouchableOpacity> */}
            </View>
          )}
        </ThemedView>

        <LanguagePicker
          visible={showSourcePicker}
          selectedLanguage={sourceLanguage}
          languages={LANGUAGES}
          onSelect={setSourceLanguage}
          onClose={() => setShowSourcePicker(false)}
          onShowPaywall={() => {
            setShowSourcePicker(false);
            setShowPaywall(true);
          }}
        />
        <LanguagePicker
          visible={showTargetPicker}
          selectedLanguage={targetLanguage}
          languages={LANGUAGES}
          onSelect={setTargetLanguage}
          onClose={() => setShowTargetPicker(false)}
          onShowPaywall={() => {
            setShowTargetPicker(false);
            setShowPaywall(true);
          }}
        />
        <PremiumLanguagesPaywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          onPurchaseComplete={() => {
            setShowPaywall(false);
          }}
        />
      </View>
    </Pressable>
    );
  };

  // Render Camera Mode
  const renderCameraMode = () => {
    if (status === 'loading' || status === 'downloading') {
      return (
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>
            {status === 'downloading' 
              ? `Downloading Translation AI Model... ${progress}%` 
              : 'Loading Translation AI Model...'}
          </ThemedText>
          {status === 'downloading' && (
            <View style={[styles.progressBar, { backgroundColor: colors.icon + '20' }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: colors.tint,
                    width: `${progress}%`
                  }
                ]} 
              />
            </View>
          )}
          <ThemedText style={[styles.loadingSubtext, { color: colors.icon }]}>
            {status === 'downloading'
              ? "This may take a few minutes. Please don't close the app."
              : 'This may take a few seconds'}
          </ThemedText>
        </View>
      );
    }

    if (!cameraPermission) {
      return <View />;
    }

    if (!cameraPermission.granted) {
      return (
        <ThemedView style={[styles.container, styles.centerContent]}>
          <ThemedText style={styles.message}>We need your permission to show the camera</ThemedText>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.tint }]} 
            onPress={requestCameraPermission}
          >
            <ThemedText style={styles.buttonText}>Grant Permission</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      );
    }

    if (currentPage === 'extract') {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <ScrollView style={styles.pageContainer}>
            <ThemedView style={styles.textSection}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Extracted Text:</ThemedText>
              {isExtracting ? (
                <ActivityIndicator size="large" color={colors.tint} />
              ) : (
                <ThemedText style={styles.extractedText}>{extractedText}</ThemedText>
              )}
            </ThemedView>

            {extractedText && !isExtracting && extractedText !== 'No text found in image' && extractedText !== 'Error extracting text from image' && (
              <>
                <ThemedView style={styles.languageSection}>
                  <ThemedText style={styles.languageLabel}>Translate to:</ThemedText>
                  <TouchableOpacity
                    style={[styles.languageButton, { backgroundColor: colors.tint + '20' }]}
                    onPress={() => setShowCameraLanguagePicker(true)}>
                    <ThemedText style={[styles.languageButtonText, { color: colors.tint }]}>
                      {targetLanguage.name}
                    </ThemedText>
                    <IconSymbol name="chevron.down" size={14} color={colors.tint} />
                  </TouchableOpacity>
                </ThemedView>

                <TouchableOpacity 
                  style={[styles.button, { backgroundColor: colors.tint }]}
                  onPress={translateCameraText}
                  disabled={isCameraTranslating}
                >
                  {isCameraTranslating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconSymbol size={24} name="arrow.left.arrow.right" color="#fff" />
                  )}
                  <ThemedText style={styles.buttonText}>
                    {isCameraTranslating ? 'Translating...' : 'Translate'}
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: colors.tint, marginTop: 10 }]} 
              onPress={retakePhoto}
            >
              <IconSymbol size={24} name="camera.fill" color="#fff" />
              <ThemedText style={styles.buttonText}>Take Another Photo</ThemedText>
            </TouchableOpacity>
          </ScrollView>
          <LanguagePicker
            visible={showCameraLanguagePicker}
            selectedLanguage={targetLanguage}
            languages={LANGUAGES}
            onSelect={setTargetLanguage}
            onClose={() => setShowCameraLanguagePicker(false)}
            onShowPaywall={() => {
              setShowCameraLanguagePicker(false);
              setShowPaywall(true);
            }}
          />
        </View>
      );
    }

    if (currentPage === 'translate') {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <ScrollView style={styles.pageContainer}>
            <ThemedView style={styles.textSection}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Translation:</ThemedText>
              <ThemedText style={styles.cameraTranslatedText}>{cameraTranslatedText}</ThemedText>
            </ThemedView>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: colors.tint }]} 
              onPress={retakePhoto}
            >
              <IconSymbol size={24} name="camera.fill" color="#fff" />
              <ThemedText style={styles.buttonText}>Take Another Photo</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

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
  };

  // Render Conversation Mode
  const ChatSection = ({
    allMessages,
    language,
    onLanguagePress,
    onRecordPress,
    isRecording,
    isUpsideDown = false,
    currentTranscript = '',
  }: {
    allMessages: Message[];
    language: typeof LANGUAGES[0];
    onLanguagePress: () => void;
    onRecordPress: () => void;
    isRecording: boolean;
    isUpsideDown?: boolean;
    currentTranscript?: string;
  }) => {
    const sectionSpeaker = isUpsideDown ? 'upper' : 'lower';
    const sectionMessages = allMessages.filter(m => m.speaker === sectionSpeaker);
    
    return (
      <ThemedView
        style={[
          styles.chatSection,
          { borderColor: colors.icon + '30', backgroundColor: colorScheme === 'dark' ? '#1f2022' : '#fff' },
          isUpsideDown && styles.upsideDown,
        ]}>
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.conversationLanguageButton, { backgroundColor: colors.tint + '20' }]}
            onPress={onLanguagePress}>
            <ThemedText style={[styles.languageButtonText, { color: colors.tint }]}>
              {language.name}
            </ThemedText>
            <IconSymbol name="chevron.down" size={14} color={colors.tint} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.recordButton,
              {
                backgroundColor: isRecording ? '#ff4444' : colors.tint,
              },
            ]}
            onPress={onRecordPress}>
            <IconSymbol
              name={isRecording ? 'stop.circle.fill' : 'mic.circle.fill'}
              size={32}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}>
          {sectionMessages.length === 0 && !currentTranscript ? (
            <View style={styles.emptyState}>
              <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                {isUpsideDown ? 'Opponent messages' : 'Your messages'}
              </ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: colors.icon }]}>
                Press the mic button to start recording
              </ThemedText>
            </View>
          ) : (
            <>
              {sectionMessages.map((message) => {
                const alignRight = message.isOriginal;
                
                return (
                  <View 
                    key={message.id} 
                    style={[
                      styles.messageContainer,
                      { alignItems: alignRight ? 'flex-end' : 'flex-start' }
                    ]}>
                    <ThemedView
                      style={[
                        styles.messageBubble,
                        { backgroundColor: alignRight ? colors.tint + '20' : colors.icon + '20' },
                      ]}>
                      <ThemedText style={styles.messageText}>{message.text}</ThemedText>
                      <ThemedText style={[styles.messageTime, { color: colors.icon }]}>
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </ThemedText>
                    </ThemedView>
                  </View>
                );
              })}
              {currentTranscript && (
                <View style={[styles.messageContainer, { alignItems: 'flex-end' }]}>
                  <ThemedView
                    style={[
                      styles.messageBubble,
                      styles.transcriptBubble,
                      { backgroundColor: colors.tint + '10', borderColor: colors.tint + '40' },
                    ]}>
                    <ThemedText style={[styles.messageText, { opacity: 0.7 }]}>
                      {currentTranscript}
                    </ThemedText>
                  </ThemedView>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </ThemedView>
    );
  };

  const renderConversationMode = () => {
    if (status === 'loading' || status === 'downloading') {
      return (
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>
            {status === 'downloading' 
              ? `Downloading Translation AI Model... ${progress}%` 
              : 'Loading Translation AI Model...'}
          </ThemedText>
          {status === 'downloading' && (
            <View style={[styles.progressBar, { backgroundColor: colors.icon + '20' }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: colors.tint,
                    width: `${progress}%`
                  }
                ]} 
              />
            </View>
          )}
          <ThemedText style={[styles.loadingSubtext, { color: colors.icon }]}>
            {status === 'downloading'
              ? "This may take a few minutes. Please don't close the app."
              : 'This may take a few seconds'}
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ChatSection
          allMessages={allMessages}
          language={upperLanguage}
          onLanguagePress={() => setShowUpperLanguagePicker(true)}
          onRecordPress={() => handleRecordPress('upper')}
          isRecording={isRecordingUpper}
          isUpsideDown={true}
          currentTranscript={currentUpperTranscript}
        />

        <View style={[styles.divider, { backgroundColor: colors.icon + '30' }]} />

        <ChatSection
          allMessages={allMessages}
          language={lowerLanguage}
          onLanguagePress={() => setShowLowerLanguagePicker(true)}
          onRecordPress={() => handleRecordPress('lower')}
          isRecording={isRecordingLower}
          isUpsideDown={false}
          currentTranscript={currentLowerTranscript}
        />

        <LanguagePicker
          visible={showUpperLanguagePicker}
          selectedLanguage={upperLanguage}
          languages={LANGUAGES}
          onSelect={setUpperLanguage}
          onClose={() => setShowUpperLanguagePicker(false)}
          onShowPaywall={() => {
            setShowUpperLanguagePicker(false);
            setShowPaywall(true);
          }}
        />
        <LanguagePicker
          visible={showLowerLanguagePicker}
          selectedLanguage={lowerLanguage}
          languages={LANGUAGES}
          onSelect={setLowerLanguage}
          onClose={() => setShowLowerLanguagePicker(false)}
          onShowPaywall={() => {
            setShowLowerLanguagePicker(false);
            setShowPaywall(true);
          }}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.background }]} edges={['top']}>
      <DownloadPromptModal
        visible={showDownloadPrompt}
        title="Download AI Translation Model"
        description="To use offline translation, we need to download the AI model to your device."
        downloadSize="~2.6 GB"
        downloadTime="10-30 minutes"
        onConfirm={() => {
          setShowDownloadPrompt(false);
          initializeModel();
        }}
        onCancel={() => setShowDownloadPrompt(false)}
      />
      {mode === 'translate' && renderTextTranslateMode()}
      {mode === 'camera' && renderCameraMode()}
      {mode === 'conversation' && renderConversationMode()}
      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  progressBar: {
    width: '80%',
    height: 8,
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  bottomTabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabButtonText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    marginHorizontal: 20,
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
  translatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  // Camera styles
  camera: {
    flex: 1,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    marginTop: 16,
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
  cameraTranslatedText: {
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
  // Conversation styles
  chatSection: {
    flex: 1,
    borderWidth: 1,
    margin: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  upsideDown: {
    transform: [{ rotate: '180deg' }],
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  conversationLanguageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  messageContainer: {
    marginVertical: 6,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  transcriptBubble: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    height: 2,
    marginHorizontal: 16,
  },
});
