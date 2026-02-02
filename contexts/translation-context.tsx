import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useTranslation } from '@/hooks/use-translation';

type TranslationContextType = ReturnType<typeof useTranslation>;

const TranslationContext = createContext<TranslationContextType | null>(null);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const translation = useTranslation();

  // Initialize the model once when the provider mounts
  useEffect(() => {
    translation.initializeModel();
  }, [translation.initializeModel]);

  return (
    <TranslationContext.Provider value={translation}>
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
