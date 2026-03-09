import { File, Paths } from 'expo-file-system';
import { initLlama, LlamaContext } from 'llama.rn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import TextRecognition from 'react-native-text-recognition';

// Language codes for TranslateGemma
const LANGUAGE_CODES: Record<string, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
  zh: 'zh',
  ja: 'ja',
  ko: 'ko',
};

// Model download URL from HuggingFace
const MODEL_DOWNLOAD_URL = 'https://holfun.com/translategemma-4b-it.Q4_K_S.gguf';
const MODEL_FILENAME = 'translategemma-4b-it.Q4_K_S.gguf';

export type TranslationStatus = 'idle' | 'loading' | 'ready' | 'translating' | 'error' | 'downloading';

export function useTranslation() {
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const contextRef = useRef<LlamaContext | null>(null);

  // Initialize the model
  const initializeModel = useCallback(async () => {
    if (contextRef.current) {
      return; // Already initialized
    }

    try {
      setStatus('loading');
      setError(null);
      setProgress(0);

      const modelFile = new File(Paths.document, MODEL_FILENAME);
      
      // Check if model exists in documents directory
      if (!modelFile.exists) {
        console.log('Model not found, starting download...');
        setStatus('downloading');
        
        // Fake progress simulator - increment from 0 to 100% over 10 seconds
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            const next = prev + 1;
            return next > 100 ? 100 : next;
          });
        }, 100); // Update every 100ms for smooth animation
        
        try {
          // Download the model from HuggingFace
          console.log('Downloading model from:', MODEL_DOWNLOAD_URL);
          
          // Use File.downloadFileAsync to download to the documents directory
          const downloadedFile = await File.downloadFileAsync(MODEL_DOWNLOAD_URL, Paths.document);
          
          clearInterval(progressInterval);
          setProgress(100);
          
          console.log('Model downloaded successfully to:', downloadedFile.uri);
          console.log('File exists:', downloadedFile.exists);
          
          // The file might have a different name from the URL, so let's rename it if needed
          if (downloadedFile.name !== MODEL_FILENAME) {
            console.log('Renaming file from', downloadedFile.name, 'to', MODEL_FILENAME);
            await downloadedFile.move(modelFile);
          }
        } catch (downloadErr) {
          clearInterval(progressInterval);
          // The download may throw "Response body is not readable" but still succeed
          // Check if the file exists before treating as an error
          console.warn('Download threw error:', downloadErr);
          
          // Re-check if model file exists now
          const recheckFile = new File(Paths.document, MODEL_FILENAME);
          if (!recheckFile.exists) {
            // Also check if the downloaded file exists with the URL filename
            const urlFilename = MODEL_DOWNLOAD_URL.split('/').pop() || MODEL_FILENAME;
            const downloadedFile = new File(Paths.document, urlFilename);
            
            if (downloadedFile.exists && urlFilename !== MODEL_FILENAME) {
              console.log('Found downloaded file, renaming...');
              await downloadedFile.move(modelFile);
              setProgress(100);
            } else if (!downloadedFile.exists) {
              console.error('Download failed:', downloadErr);
              setError(
                downloadErr instanceof Error
                  ? `Failed to download model: ${downloadErr.message}`
                  : 'Failed to download model'
              );
              setStatus('error');
              return;
            }
          } else {
            console.log('File exists despite error, continuing...');
            setProgress(100);
          }
        }
      }

      setStatus('loading');
      const modelPath = modelFile.uri;
      console.log('Loading model from:', modelPath);

      const context = await initLlama(
        {
          model: modelPath,
          use_mlock: true,
          n_ctx: 2048,
          n_gpu_layers: Platform.OS === 'ios' ? 99 : 0, // Use Metal on iOS
          n_batch: 512,
        },
        (loadProgress) => {
          // Normalize progress value and cap at 100%
          const percentage = Math.min(100, loadProgress > 1 ? Math.round(loadProgress) : Math.round(loadProgress * 100));
          setProgress(percentage);
          console.log('Model loading progress:', percentage + '%', '(raw:', loadProgress + ')');
        }
      );

      contextRef.current = context;
      setStatus('ready');
      console.log('Model loaded successfully');
    } catch (err) {
      console.error('Failed to initialize model:', err);
      setError(err instanceof Error ? err.message : 'Failed to load translation model');
      setStatus('error');
    }
  }, []);

  // Translate text
  const translate = useCallback(
    async (
      text: string,
      sourceLanguage: string,
      targetLanguage: string,
      onPartialResult?: (partial: string) => void
    ): Promise<string> => {
      if (!contextRef.current) {
        throw new Error('Model not initialized');
      }

      if (!text.trim()) {
        return '';
      }

      setStatus('translating');

      try {
        const sourceLang = LANGUAGE_CODES[sourceLanguage] || sourceLanguage;
        const targetLang = LANGUAGE_CODES[targetLanguage] || targetLanguage;

        // TranslateGemma prompt format based on Gemma 3 chat template
        // The model expects a specific format for translation tasks
        const prompt = `<bos><start_of_turn>user
Translate from ${sourceLang} to ${targetLang}:
${text}<end_of_turn>
<start_of_turn>model
`;

        let result = '';

        const completionResult = await contextRef.current.completion(
          {
            prompt,
            n_predict: 1024,
            stop: ['<end_of_turn>', '<eos>', '</s>'],
            temperature: 0.1, // Low temperature for more deterministic translation
            top_p: 0.9,
            top_k: 40,
          },
          (data) => {
            if (data.token) {
              result += data.token;
              onPartialResult?.(result.trim());
            }
          }
        );

        setStatus('ready');
        return completionResult.text.trim();
      } catch (err) {
        console.error('Translation error:', err);
        setError(err instanceof Error ? err.message : 'Translation failed');
        setStatus('error');
        throw err;
      }
    },
    []
  );

  // Translate image (extract and translate text from image)
  const translateImage = useCallback(
    async (
      imageUri: string,
      sourceLanguage: string,
      targetLanguage: string,
      onPartialResult?: (partial: string) => void
    ): Promise<{ extractedText: string; translatedText: string }> => {
      if (!contextRef.current) {
        throw new Error('Model not initialized');
      }

      setStatus('translating');

      try {
        // Step 1: Extract text from image using OCR
        console.log('Extracting text from image:', imageUri);
        const result = await TextRecognition.recognize(imageUri);
        
        console.log('OCR raw result:', result);
        
        // Convert result to string, handling all possible types
        let extractedText: string;
        
        if (Array.isArray(result)) {
          // If it's an array of strings, join them
          extractedText = result.join('\n');
        } else if (typeof result === 'string') {
          extractedText = result;
        } else if (result && typeof result === 'object' && 'text' in result) {
          extractedText = String(result.text);
        } else {
          extractedText = String(result || '');
        }
        
        console.log('Converted to string:', extractedText);
        console.log('String type check:', typeof extractedText);
        
        if (!extractedText || extractedText.trim().length === 0) {
          setStatus('ready');
          return {
            extractedText: 'No text found in image',
            translatedText: '',
          };
        }

        // Step 2: Translate the extracted text
        const translatedText = await translate(
          extractedText,
          sourceLanguage,
          targetLanguage,
          onPartialResult
        );

        setStatus('ready');
        return {
          extractedText,
          translatedText,
        };
      } catch (err) {
        console.error('Image translation error:', err);
        setError(err instanceof Error ? err.message : 'Image translation failed');
        setStatus('error');
        throw err;
      }
    },
    [translate]
  );

  // Release the model manually
  const releaseModel = useCallback(() => {
    if (contextRef.current) {
      console.log('Releasing translation model...');
      contextRef.current.release();
      contextRef.current = null;
      setStatus('idle');
      setError(null);
      setProgress(0);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (contextRef.current) {
        contextRef.current.release();
        contextRef.current = null;
      }
    };
  }, []);

  return {
    status,
    error,
    progress,
    initializeModel,
    translate,
    translateImage,
    releaseModel,
    isReady: status === 'ready',
    isLoading: status === 'loading',
    isTranslating: status === 'translating',
    isDownloading: status === 'downloading',
  };
}
