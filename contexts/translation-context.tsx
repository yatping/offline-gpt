import { useTranslation } from '@/hooks/use-translation';
import {
    DEFAULT_MY_LANGUAGE,
    DEFAULT_OPPONENT_LANGUAGE,
    DEFAULT_SOURCE_LANGUAGE,
    DEFAULT_TARGET_LANGUAGE,
    Language,
    loadMyLanguage,
    loadOpponentLanguage,
    loadSourceLanguage,
    loadTargetLanguage,
    saveMyLanguage,
    saveOpponentLanguage,
    saveSourceLanguage,
    saveTargetLanguage,
} from '@/utils/language-preferences';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type TranslationContextType = ReturnType<typeof useTranslation> & {
  // Text translation languages (index/camera screens)
  sourceLanguage: Language;
  targetLanguage: Language;
  setSourceLanguage: (language: Language) => void;
  setTargetLanguage: (language: Language) => void;
  
  // Conversation languages (conversation screen)
  myLanguage: Language;
  opponentLanguage: Language;
  setMyLanguage: (language: Language) => void;
  setOpponentLanguage: (language: Language) => void;
};

const TranslationContext = createContext<TranslationContextType | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const translation = useTranslation();
  
  // Language preferences state
  const [sourceLanguage, setSourceLanguageState] = useState<Language>(DEFAULT_SOURCE_LANGUAGE);
  const [targetLanguage, setTargetLanguageState] = useState<Language>(DEFAULT_TARGET_LANGUAGE);
  const [myLanguage, setMyLanguageState] = useState<Language>(DEFAULT_MY_LANGUAGE);
  const [opponentLanguage, setOpponentLanguageState] = useState<Language>(DEFAULT_OPPONENT_LANGUAGE);

  // Don't initialize the model automatically - let components trigger it when needed
  // useEffect(() => {
  //   translation.initializeModel();
  // }, [translation.initializeModel]);

  // Load saved language preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      const [source, target, my, opponent] = await Promise.all([
        loadSourceLanguage(),
        loadTargetLanguage(),
        loadMyLanguage(),
        loadOpponentLanguage(),
      ]);
      setSourceLanguageState(source);
      setTargetLanguageState(target);
      setMyLanguageState(my);
      setOpponentLanguageState(opponent);
    };
    loadPreferences();
  }, []);

  // Sync conversation languages with index/camera languages
  // When source language changes, update my language to match
  useEffect(() => {
    const syncMyLanguage = async () => {
      const speechLang = await loadMyLanguage();
      setMyLanguageState(speechLang);
    };
    syncMyLanguage();
  }, [sourceLanguage]);

  // When target language changes, update opponent language to match
  useEffect(() => {
    const syncOpponentLanguage = async () => {
      const speechLang = await loadOpponentLanguage();
      setOpponentLanguageState(speechLang);
    };
    syncOpponentLanguage();
  }, [targetLanguage]);

  // Reverse sync: When my language changes on conversation, update source language
  useEffect(() => {
    const syncSourceLanguage = async () => {
      const lang = await loadSourceLanguage();
      setSourceLanguageState(lang);
    };
    syncSourceLanguage();
  }, [myLanguage]);

  // Reverse sync: When opponent language changes on conversation, update target language
  useEffect(() => {
    const syncTargetLanguage = async () => {
      const lang = await loadTargetLanguage();
      setTargetLanguageState(lang);
    };
    syncTargetLanguage();
  }, [opponentLanguage]);

  // Wrapper functions to save when setting
  const setSourceLanguage = (language: Language) => {
    setSourceLanguageState(language);
    saveSourceLanguage(language);
  };

  const setTargetLanguage = (language: Language) => {
    setTargetLanguageState(language);
    saveTargetLanguage(language);
  };

  const setMyLanguage = (language: Language) => {
    setMyLanguageState(language);
    saveMyLanguage(language);
  };

  const setOpponentLanguage = (language: Language) => {
    setOpponentLanguageState(language);
    saveOpponentLanguage(language);
  };

  return (
    <TranslationContext.Provider 
      value={{
        ...translation,
        sourceLanguage,
        targetLanguage,
        setSourceLanguage,
        setTargetLanguage,
        myLanguage,
        opponentLanguage,
        setMyLanguage,
        setOpponentLanguage,
      }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslationContext() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslationContext must be used within TranslationProvider');
  }
  return context;
}
