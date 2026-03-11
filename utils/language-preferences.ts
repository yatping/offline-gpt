import AsyncStorage from '@react-native-async-storage/async-storage';

export const LANGUAGES = [
  { code: 'en', speechCode: 'en-US', name: 'English', isFree: true },
  { code: 'es', speechCode: 'es-ES', name: 'Spanish', isFree: true },
  { code: 'ar', speechCode: 'ar-SA', name: 'Arabic', isFree: false },
  { code: 'bn', speechCode: 'bn-IN', name: 'Bengali', isFree: false },
  { code: 'bg', speechCode: 'bg-BG', name: 'Bulgarian', isFree: false },
  { code: 'ca', speechCode: 'ca-ES', name: 'Catalan', isFree: false },
  { code: 'zh', speechCode: 'zh-CN', name: 'Chinese', isFree: true },
  { code: 'hr', speechCode: 'hr-HR', name: 'Croatian', isFree: false },
  { code: 'cs', speechCode: 'cs-CZ', name: 'Czech', isFree: false },
  { code: 'da', speechCode: 'da-DK', name: 'Danish', isFree: false },
  { code: 'nl', speechCode: 'nl-NL', name: 'Dutch', isFree: false },
  { code: 'fi', speechCode: 'fi-FI', name: 'Finnish', isFree: false },
  { code: 'fr', speechCode: 'fr-FR', name: 'French', isFree: true },
  { code: 'de', speechCode: 'de-DE', name: 'German', isFree: true },
  { code: 'el', speechCode: 'el-GR', name: 'Greek', isFree: false },
  { code: 'he', speechCode: 'he-IL', name: 'Hebrew', isFree: false },
  { code: 'hi', speechCode: 'hi-IN', name: 'Hindi', isFree: false },
  { code: 'hu', speechCode: 'hu-HU', name: 'Hungarian', isFree: false },
  { code: 'id', speechCode: 'id-ID', name: 'Indonesian', isFree: false },
  { code: 'it', speechCode: 'it-IT', name: 'Italian', isFree: false },
  { code: 'ja', speechCode: 'ja-JP', name: 'Japanese', isFree: true },
  { code: 'ko', speechCode: 'ko-KR', name: 'Korean', isFree: false },
  { code: 'no', speechCode: 'no-NO', name: 'Norwegian', isFree: false },
  { code: 'pl', speechCode: 'pl-PL', name: 'Polish', isFree: false },
  { code: 'pt', speechCode: 'pt-PT', name: 'Portuguese', isFree: false },
  { code: 'ro', speechCode: 'ro-RO', name: 'Romanian', isFree: false },
  { code: 'ru', speechCode: 'ru-RU', name: 'Russian', isFree: false },
  { code: 'sk', speechCode: 'sk-SK', name: 'Slovak', isFree: false },
  { code: 'sv', speechCode: 'sv-SE', name: 'Swedish', isFree: false },
  { code: 'th', speechCode: 'th-TH', name: 'Thai', isFree: false },
  { code: 'tr', speechCode: 'tr-TR', name: 'Turkish', isFree: false },
  { code: 'uk', speechCode: 'uk-UA', name: 'Ukrainian', isFree: false },
  { code: 'vi', speechCode: 'vi-VN', name: 'Vietnamese', isFree: false },
];

export type Language = typeof LANGUAGES[number];

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
export const DEFAULT_MY_LANGUAGE = LANGUAGES[0]; // English (for speech)
export const DEFAULT_OPPONENT_LANGUAGE = LANGUAGES[1]; // Spanish (for speech)

// Get language by code
export const getLanguageByCode = (code: string): Language => {
  return LANGUAGES.find((lang) => lang.code === code) || DEFAULT_SOURCE_LANGUAGE;
};

// Get language by speech code (e.g., 'en-US' -> English language object)
export const getLanguageBySpeechCode = (speechCode: string): Language => {
  // First try exact match
  let match = LANGUAGES.find((lang) => lang.speechCode === speechCode);
  if (match) return match;
  
  // If not found, try matching base code (e.g., 'en' from 'en-US')
  const baseCode = speechCode.split('-')[0];
  match = LANGUAGES.find((lang) => lang.code === baseCode);
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
export const saveMyLanguage = async (language: Language) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_LANGUAGE, language.code);
  } catch (error) {
    console.error('Failed to save my language:', error);
  }
};

// Load my language (for conversation screen - lower section)
// This shares the same storage as source language for consistency
export const loadMyLanguage = async (): Promise<Language> => {
  try {
    const code = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_LANGUAGE);
    if (code) {
      return getLanguageByCode(code);
    }
  } catch (error) {
    console.error('Failed to load my language:', error);
  }
  return DEFAULT_MY_LANGUAGE;
};

// Save opponent language (for conversation screen - upper section)
// This shares the same storage as target language for consistency
export const saveOpponentLanguage = async (language: Language) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TARGET_LANGUAGE, language.code);
  } catch (error) {
    console.error('Failed to save opponent language:', error);
  }
};

// Load opponent language (for conversation screen - upper section)
// This shares the same storage as target language for consistency
export const loadOpponentLanguage = async (): Promise<Language> => {
  try {
    const code = await AsyncStorage.getItem(STORAGE_KEYS.TARGET_LANGUAGE);
    if (code) {
      return getLanguageByCode(code);
    }
  } catch (error) {
    console.error('Failed to load opponent language:', error);
  }
  return DEFAULT_OPPONENT_LANGUAGE;
};
