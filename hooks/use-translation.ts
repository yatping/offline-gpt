import TranslateText from '@react-native-ml-kit/translate-text';
import { useCallback, useState } from 'react';

export type TranslationStatus = 'idle' | 'translating' | 'error';

export function useTranslation() {
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback(
    async (
      text: string,
      sourceLanguage: string,
      targetLanguage: string,
    ): Promise<string> => {
      if (!text.trim()) {
        return '';
      }

      setStatus('translating');
      setError(null);

      try {
        const result = await TranslateText.translate({
          text,
          sourceLanguage: sourceLanguage as any,
          targetLanguage: targetLanguage as any,
          downloadModelIfNeeded: true,
        });

        setStatus('idle');
        return (result as unknown as string) ?? '';
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Translation failed';
        setError(message);
        setStatus('error');
        throw err;
      }
    },
    []
  );

  return {
    status,
    error,
    translate,
    isTranslating: status === 'translating',
  };
}
