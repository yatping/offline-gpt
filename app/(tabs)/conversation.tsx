import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useTranslationContext } from '@/contexts/translation-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const LANGUAGES = [
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-PT', name: 'Portuguese' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
];

// Helper function to get locale code for speech recognition
const getLocaleCode = (code: string): string => {
  return code;
};

type Message = {
  id: string;
  text: string;
  timestamp: Date;
  speaker: 'upper' | 'lower';
  isOriginal: boolean; // true for original speech, false for translated
};

export default function ConversationScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { translate, isReady } = useTranslationContext();

  // Shared message state - both sections see all messages but filter by speaker
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  
  // Upper section (opponent - upside down)
  const [upperLanguage, setUpperLanguage] = useState(LANGUAGES[0]);
  const [isRecordingUpper, setIsRecordingUpper] = useState(false);
  const [showUpperLanguagePicker, setShowUpperLanguagePicker] = useState(false);
  const [currentUpperTranscript, setCurrentUpperTranscript] = useState('');
  const [pendingUpperText, setPendingUpperText] = useState('');

  // Lower section (user)
  const [lowerLanguage, setLowerLanguage] = useState(LANGUAGES[1]);
  const [isRecordingLower, setIsRecordingLower] = useState(false);
  const [showLowerLanguagePicker, setShowLowerLanguagePicker] = useState(false);
  const [currentLowerTranscript, setCurrentLowerTranscript] = useState('');
  const [pendingLowerText, setPendingLowerText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // Request permissions on mount
  useEffect(() => {
    const requestPermissions = async () => {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert(
          'Permission Required',
          'Speech recognition permission is required for this feature.'
        );
      }
    };
    requestPermissions();
  }, []);

  // Listen for speech recognition events
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript || '';
    const isFinal = event.isFinal;

    if (isRecordingUpper) {
      setCurrentUpperTranscript(transcript);
      if (isFinal) {
        // Store the final transcript but don't translate yet
        setPendingUpperText(transcript);
        // Keep showing the transcript (don't clear it)
      }
    } else if (isRecordingLower) {
      setCurrentLowerTranscript(transcript);
      if (isFinal) {
        // Store the final transcript but don't translate yet
        setPendingLowerText(transcript);
        // Keep showing the transcript (don't clear it)
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error:', event.error, 'Message:', event.message);
    
    // If it's a network error (speech service crashed), show helpful message
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

  // Add original message only (no translation yet)
  const addOriginalMessage = (section: 'upper' | 'lower', text: string) => {
    if (!text.trim()) return;

    const speaker = section === 'upper' ? 'upper' : 'lower';
    
    // Add the original message (will show on RIGHT in speaker's own section)
    const originalMessage: Message = {
      id: Date.now().toString(),
      text,
      timestamp: new Date(),
      speaker: speaker,
      isOriginal: true,
    };
    setAllMessages((prev) => [...prev, originalMessage]);
  };

  // Translate and add translated message
  const translateAndAddMessage = async (section: 'upper' | 'lower', text: string) => {
    if (!text.trim()) return;

    const speaker = section === 'upper' ? 'upper' : 'lower';
    const oppositeSpeaker = section === 'upper' ? 'lower' : 'upper';

    // If translation model is not ready, skip translation
    if (!isReady) {
      console.warn('Translation model not ready');
      return;
    }

    // Translate and add to opponent's section
    setIsTranslating(true);
    try {
      const sourceLanguage = section === 'upper' ? upperLanguage.code : lowerLanguage.code;
      const targetLanguage = section === 'upper' ? lowerLanguage.code : upperLanguage.code;
      
      // Extract base language code (e.g., 'en' from 'en-US')
      const sourceLang = sourceLanguage.split('-')[0];
      const targetLang = targetLanguage.split('-')[0];

      const translatedText = await translate(text, sourceLang, targetLang);
      
      // Add translated message to opponent's section (isOriginal=false means LEFT)
      const translatedMessage: Message = {
        id: `${Date.now()}-translated`,
        text: translatedText,
        timestamp: new Date(),
        speaker: oppositeSpeaker,
        isOriginal: false,
      };
      setAllMessages((prev) => [...prev, translatedMessage]);
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Translation Error', 'Failed to translate message');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRecordPress = async (section: 'upper' | 'lower') => {
    try {
      if (section === 'upper') {
        if (isRecordingUpper) {
          // Stop recording
          await ExpoSpeechRecognitionModule.stop();
          setIsRecordingUpper(false);
          
          // Use either pending text or current transcript
          const textToTranslate = pendingUpperText || currentUpperTranscript;
          
          // Add original message and translate when stop is clicked
          if (textToTranslate) {
            addOriginalMessage('upper', textToTranslate);
            await translateAndAddMessage('upper', textToTranslate);
            setPendingUpperText('');
            setCurrentUpperTranscript(''); // Clear after translation
          }
        } else {
          // Start recording
          await ExpoSpeechRecognitionModule.start({
            lang: upperLanguage.code,
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
          // Stop recording
          await ExpoSpeechRecognitionModule.stop();
          setIsRecordingLower(false);
          
          // Use either pending text or current transcript
          const textToTranslate = pendingLowerText || currentLowerTranscript;
          
          // Add original message and translate when stop is clicked
          if (textToTranslate) {
            addOriginalMessage('lower', textToTranslate);
            await translateAndAddMessage('lower', textToTranslate);
            setPendingLowerText('');
            setCurrentLowerTranscript(''); // Clear after translation
          }
        } else {
          // Start recording
          await ExpoSpeechRecognitionModule.start({
            lang: lowerLanguage.code,
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
      console.error('Error starting/stopping speech recognition:', error);
      Alert.alert('Error', 'Failed to start speech recognition');
      setIsRecordingUpper(false);
      setIsRecordingLower(false);
    }
  };

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
      <View style={[styles.pickerOverlay, { backgroundColor: colors.background }]}>
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
    // Filter messages for this section's speaker
    const sectionSpeaker = isUpsideDown ? 'upper' : 'lower';
    const sectionMessages = allMessages.filter(m => m.speaker === sectionSpeaker);
    
    return (
      <ThemedView
        style={[
          styles.chatSection,
          { borderColor: colors.icon + '30' },
          isUpsideDown && styles.upsideDown,
        ]}>
        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.languageButton, { backgroundColor: colors.tint + '20' }]}
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

        {/* Messages */}
        <ScrollView
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          inverted={isUpsideDown}>
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
                // Original messages on RIGHT, translated messages on LEFT
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Upper Section - Upside Down for Opponent */}
      <ChatSection
        allMessages={allMessages}
        language={upperLanguage}
        onLanguagePress={() => setShowUpperLanguagePicker(true)}
        onRecordPress={() => handleRecordPress('upper')}
        isRecording={isRecordingUpper}
        isUpsideDown={true}
        currentTranscript={currentUpperTranscript}
      />

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.icon + '30' }]} />

      {/* Lower Section - Normal for User */}
      <ChatSection
        allMessages={allMessages}
        language={lowerLanguage}
        onLanguagePress={() => setShowLowerLanguagePicker(true)}
        onRecordPress={() => handleRecordPress('lower')}
        isRecording={isRecordingLower}
        isUpsideDown={false}
        currentTranscript={currentLowerTranscript}
      />

      {/* Language Pickers */}
      <LanguagePicker
        visible={showUpperLanguagePicker}
        onSelect={setUpperLanguage}
        onClose={() => setShowUpperLanguagePicker(false)}
      />
      <LanguagePicker
        visible={showLowerLanguagePicker}
        onSelect={setLowerLanguage}
        onClose={() => setShowLowerLanguagePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
