import AsyncStorage from '@react-native-async-storage/async-storage';

// All languages supported by @react-native-ml-kit/translate-text and
// react-native-vision-camera-ocr-plus (Google ML Kit Translation)
export const LANGUAGES = [
  { code: 'af', speechCode: 'af-ZA', name: 'Afrikaans', isFree: false },
  { code: 'sq', speechCode: 'sq-AL', name: 'Albanian', isFree: false },
  { code: 'ar', speechCode: 'ar-SA', name: 'Arabic', isFree: false },
  { code: 'be', speechCode: 'be-BY', name: 'Belarusian', isFree: false },
  { code: 'bn', speechCode: 'bn-IN', name: 'Bengali', isFree: false },
  { code: 'bg', speechCode: 'bg-BG', name: 'Bulgarian', isFree: false },
  { code: 'ca', speechCode: 'ca-ES', name: 'Catalan', isFree: false },
  { code: 'zh', speechCode: 'zh-CN', name: 'Chinese', isFree: true },
  { code: 'cs', speechCode: 'cs-CZ', name: 'Czech', isFree: false },
  { code: 'da', speechCode: 'da-DK', name: 'Danish', isFree: false },
  { code: 'nl', speechCode: 'nl-NL', name: 'Dutch', isFree: false },
  { code: 'en', speechCode: 'en-US', name: 'English', isFree: true },
  { code: 'eo', speechCode: 'eo', name: 'Esperanto', isFree: false },
  { code: 'et', speechCode: 'et-EE', name: 'Estonian', isFree: false },
  { code: 'fi', speechCode: 'fi-FI', name: 'Finnish', isFree: false },
  { code: 'fr', speechCode: 'fr-FR', name: 'French', isFree: true },
  { code: 'gl', speechCode: 'gl-ES', name: 'Galician', isFree: false },
  { code: 'ka', speechCode: 'ka-GE', name: 'Georgian', isFree: false },
  { code: 'de', speechCode: 'de-DE', name: 'German', isFree: true },
  { code: 'el', speechCode: 'el-GR', name: 'Greek', isFree: false },
  { code: 'gu', speechCode: 'gu-IN', name: 'Gujarati', isFree: false },
  { code: 'ht', speechCode: 'ht-HT', name: 'Haitian Creole', isFree: false },
  { code: 'he', speechCode: 'he-IL', name: 'Hebrew', isFree: false },
  { code: 'hi', speechCode: 'hi-IN', name: 'Hindi', isFree: false },
  { code: 'hu', speechCode: 'hu-HU', name: 'Hungarian', isFree: false },
  { code: 'is', speechCode: 'is-IS', name: 'Icelandic', isFree: false },
  { code: 'id', speechCode: 'id-ID', name: 'Indonesian', isFree: false },
  { code: 'ga', speechCode: 'ga-IE', name: 'Irish', isFree: false },
  { code: 'it', speechCode: 'it-IT', name: 'Italian', isFree: false },
  { code: 'ja', speechCode: 'ja-JP', name: 'Japanese', isFree: true },
  { code: 'kn', speechCode: 'kn-IN', name: 'Kannada', isFree: false },
  { code: 'ko', speechCode: 'ko-KR', name: 'Korean', isFree: false },
  { code: 'lv', speechCode: 'lv-LV', name: 'Latvian', isFree: false },
  { code: 'lt', speechCode: 'lt-LT', name: 'Lithuanian', isFree: false },
  { code: 'mk', speechCode: 'mk-MK', name: 'Macedonian', isFree: false },
  { code: 'ms', speechCode: 'ms-MY', name: 'Malay', isFree: false },
  { code: 'mt', speechCode: 'mt-MT', name: 'Maltese', isFree: false },
  { code: 'mr', speechCode: 'mr-IN', name: 'Marathi', isFree: false },
  { code: 'no', speechCode: 'no-NO', name: 'Norwegian', isFree: false },
  { code: 'fa', speechCode: 'fa-IR', name: 'Persian', isFree: false },
  { code: 'pl', speechCode: 'pl-PL', name: 'Polish', isFree: false },
  { code: 'pt', speechCode: 'pt-PT', name: 'Portuguese', isFree: false },
  { code: 'ro', speechCode: 'ro-RO', name: 'Romanian', isFree: false },
  { code: 'ru', speechCode: 'ru-RU', name: 'Russian', isFree: false },
  { code: 'sk', speechCode: 'sk-SK', name: 'Slovak', isFree: false },
  { code: 'sl', speechCode: 'sl-SI', name: 'Slovenian', isFree: false },
  { code: 'es', speechCode: 'es-ES', name: 'Spanish', isFree: true },
  { code: 'sw', speechCode: 'sw-KE', name: 'Swahili', isFree: false },
  { code: 'tl', speechCode: 'tl-PH', name: 'Tagalog', isFree: false },
  { code: 'ta', speechCode: 'ta-IN', name: 'Tamil', isFree: false },
  { code: 'te', speechCode: 'te-IN', name: 'Telugu', isFree: false },
  { code: 'th', speechCode: 'th-TH', name: 'Thai', isFree: false },
  { code: 'tr', speechCode: 'tr-TR', name: 'Turkish', isFree: false },
  { code: 'uk', speechCode: 'uk-UA', name: 'Ukrainian', isFree: false },
  { code: 'ur', speechCode: 'ur-PK', name: 'Urdu', isFree: false },
  { code: 'vi', speechCode: 'vi-VN', name: 'Vietnamese', isFree: false },
  { code: 'cy', speechCode: 'cy-GB', name: 'Welsh', isFree: false },
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
