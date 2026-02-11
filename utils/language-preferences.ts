import AsyncStorage from '@react-native-async-storage/async-storage';

export const LANGUAGES = [
  { code: 'en', name: 'English', isFree: true },
  { code: 'es', name: 'Spanish', isFree: true },
  { code: 'fr', name: 'French', isFree: false },
  { code: 'de', name: 'German', isFree: false },
  { code: 'it', name: 'Italian', isFree: false },
  { code: 'pt', name: 'Portuguese', isFree: false },
  { code: 'zh', name: 'Chinese', isFree: false },
  { code: 'ja', name: 'Japanese', isFree: false },
  { code: 'ko', name: 'Korean', isFree: false },
  { code: 'ar', name: 'Arabic', isFree: false },
  { code: 'ru', name: 'Russian', isFree: false },
  { code: 'nl', name: 'Dutch', isFree: false },
  { code: 'pl', name: 'Polish', isFree: false },
  { code: 'tr', name: 'Turkish', isFree: false },
  { code: 'vi', name: 'Vietnamese', isFree: false },
  { code: 'th', name: 'Thai', isFree: false },
  { code: 'hi', name: 'Hindi', isFree: false },
  { code: 'id', name: 'Indonesian', isFree: false },
  { code: 'sv', name: 'Swedish', isFree: false },
  { code: 'da', name: 'Danish', isFree: false },
  { code: 'fi', name: 'Finnish', isFree: false },
  { code: 'no', name: 'Norwegian', isFree: false },
  { code: 'cs', name: 'Czech', isFree: false },
  { code: 'el', name: 'Greek', isFree: false },
  { code: 'he', name: 'Hebrew', isFree: false },
  { code: 'ro', name: 'Romanian', isFree: false },
  { code: 'uk', name: 'Ukrainian', isFree: false },
  { code: 'bn', name: 'Bengali', isFree: false },
  { code: 'hu', name: 'Hungarian', isFree: false },
  { code: 'sk', name: 'Slovak', isFree: false },
  { code: 'bg', name: 'Bulgarian', isFree: false },
  { code: 'hr', name: 'Croatian', isFree: false },
  { code: 'ca', name: 'Catalan', isFree: false },
];

export const SPEECH_LANGUAGES = [
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-PT', name: 'Portuguese' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'nl-NL', name: 'Dutch' },
  { code: 'pl-PL', name: 'Polish' },
  { code: 'tr-TR', name: 'Turkish' },
  { code: 'vi-VN', name: 'Vietnamese' },
  { code: 'th-TH', name: 'Thai' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'id-ID', name: 'Indonesian' },
  { code: 'sv-SE', name: 'Swedish' },
  { code: 'da-DK', name: 'Danish' },
  { code: 'fi-FI', name: 'Finnish' },
  { code: 'no-NO', name: 'Norwegian' },
  { code: 'cs-CZ', name: 'Czech' },
  { code: 'el-GR', name: 'Greek' },
  { code: 'he-IL', name: 'Hebrew' },
  { code: 'ro-RO', name: 'Romanian' },
  { code: 'uk-UA', name: 'Ukrainian' },
  { code: 'bn-IN', name: 'Bengali' },
  { code: 'hu-HU', name: 'Hungarian' },
  { code: 'sk-SK', name: 'Slovak' },
  { code: 'bg-BG', name: 'Bulgarian' },
  { code: 'hr-HR', name: 'Croatian' },
  { code: 'ca-ES', name: 'Catalan' },
];

export type Language = typeof LANGUAGES[number];
export type SpeechLanguage = typeof SPEECH_LANGUAGES[number];

// Storage keys
// Note: Target language is shared between index/camera screens and conversation opponent
// Source language is shared between index screen and conversation my-side
const STORAGE_KEYS = {
  SOURCE_LANGUAGE: '@translation/source_language', // Also used for "my language" in conversation
  TARGET_LANGUAGE: '@translation/target_language', // Also used for "opponent language" in conversation
};

// Default languages
export const DEFAULT_SOURCE_LANGUAGE = LANGUAGES[0]; // English
export const DEFAULT_TARGET_LANGUAGE = LANGUAGES[1]; // Spanish
export const DEFAULT_MY_LANGUAGE = SPEECH_LANGUAGES[0]; // English
export const DEFAULT_OPPONENT_LANGUAGE = SPEECH_LANGUAGES[1]; // Spanish

// Get language by code
export const getLanguageByCode = (code: string): Language => {
  return LANGUAGES.find((lang) => lang.code === code) || DEFAULT_SOURCE_LANGUAGE;
};

export const getSpeechLanguageByCode = (code: string): SpeechLanguage => {
  // First try exact match (e.g., 'en-US')
  let match = SPEECH_LANGUAGES.find((lang) => lang.code === code);
  if (match) return match;
  
  // If not found, try matching base code (e.g., 'en' -> 'en-US')
  match = SPEECH_LANGUAGES.find((lang) => lang.code.startsWith(code + '-'));
  return match || DEFAULT_MY_LANGUAGE;
};

// Save source language (for index/translate screen)
export const saveSourceLanguage = async (language: Language) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_LANGUAGE, language.code);
  } catch (error) {
    console.error('Failed to save source language:', error);
  }
};

// Load source language (for index/translate screen)
export const loadSourceLanguage = async (): Promise<Language> => {
  try {
    const code = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_LANGUAGE);
    if (code) {
      return getLanguageByCode(code);
    }
  } catch (error) {
    console.error('Failed to load source language:', error);
  }
  return DEFAULT_SOURCE_LANGUAGE;
};

// Save target language (for index/translate and camera screens)
export const saveTargetLanguage = async (language: Language) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TARGET_LANGUAGE, language.code);
  } catch (error) {
    console.error('Failed to save target language:', error);
  }
};

// Load target language (for index/translate and camera screens)
export const loadTargetLanguage = async (): Promise<Language> => {
  try {
    const code = await AsyncStorage.getItem(STORAGE_KEYS.TARGET_LANGUAGE);
    if (code) {
      return getLanguageByCode(code);
    }
  } catch (error) {
    console.error('Failed to load target language:', error);
  }
  return DEFAULT_TARGET_LANGUAGE;
};

// Save my language (for conversation screen - lower section)
// This shares the same storage as source language for consistency
export const saveMyLanguage = async (language: SpeechLanguage) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_LANGUAGE, language.code.split('-')[0]);
  } catch (error) {
    console.error('Failed to save my language:', error);
  }
};

// Load my language (for conversation screen - lower section)
// This shares the same storage as source language for consistency
export const loadMyLanguage = async (): Promise<SpeechLanguage> => {
  try {
    const code = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_LANGUAGE);
    if (code) {
      // Convert base language code to speech locale (e.g., 'en' -> 'en-US')
      return getSpeechLanguageByCode(code);
    }
  } catch (error) {
    console.error('Failed to load my language:', error);
  }
  return DEFAULT_MY_LANGUAGE;
};

// Save opponent language (for conversation screen - upper section)
// This shares the same storage as target language for consistency
export const saveOpponentLanguage = async (language: SpeechLanguage) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TARGET_LANGUAGE, language.code.split('-')[0]);
  } catch (error) {
    console.error('Failed to save opponent language:', error);
  }
};

// Load opponent language (for conversation screen - upper section)
// This shares the same storage as target language for consistency
export const loadOpponentLanguage = async (): Promise<SpeechLanguage> => {
  try {
    const code = await AsyncStorage.getItem(STORAGE_KEYS.TARGET_LANGUAGE);
    if (code) {
      // Convert base language code to speech locale (e.g., 'es' -> 'es-ES')
      return getSpeechLanguageByCode(code);
    }
  } catch (error) {
    console.error('Failed to load opponent language:', error);
  }
  return DEFAULT_OPPONENT_LANGUAGE;
};
