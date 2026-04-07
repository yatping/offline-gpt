import FastTranslator from 'fast-mlkit-translate-text';
import { useCallback, useRef, useState } from 'react';

export type TranslationStatus = 'idle' | 'translating' | 'error';

export function useTranslation() {
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const preparedPairRef = useRef<{ source: string; target: string } | null>(null);

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
        const sourceName = FastTranslator.languageFromTag(sourceLanguage);
        const targetName = FastTranslator.languageFromTag(targetLanguage);

        if (!sourceName || !targetName) {
          throw new Error(`Unsupported language pair: ${sourceLanguage} → ${targetLanguage}`);
        }

        const needsPrepare =
          preparedPairRef.current?.source !== sourceLanguage ||
          preparedPairRef.current?.target !== targetLanguage;

        if (needsPrepare) {
          await FastTranslator.prepare({
            source: sourceName,
            target: targetName,
            downloadIfNeeded: true,
          });
          preparedPairRef.current = { source: sourceLanguage, target: targetLanguage };
        }

        const result = await FastTranslator.translate(text);
        return result ?? '';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus('error');
        throw new Error(message);
      } finally {
        setStatus((prev) => (prev === 'translating' ? 'idle' : prev));
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
