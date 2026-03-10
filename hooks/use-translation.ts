import { File, Paths } from 'expo-file-system';
import { initLlama, LlamaContext } from 'llama.rn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import TextRecognition from 'react-native-text-recognition';
import { useDownloadManager } from '../contexts/download-manager-context';

const MODEL_FILENAME = 'translategemma-4b-it.Q4_K_S.gguf';

export type TranslationStatus = 'idle' | 'loading' | 'ready' | 'translating' | 'error' | 'downloading';

export function useTranslation() {
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<LlamaContext | null>(null);
  const isInitializingRef = useRef(false);
  const downloadManager = useDownloadManager();

  // Initialize the model
  const initializeModel = useCallback(async () => {
    if (contextRef.current) {
      return; // Already initialized
    }
    
    if (isInitializingRef.current) {
      console.log('Initialization already in progress, skipping...');
      return; // Already initializing
    }

    try {
      isInitializingRef.current = true;
      setError(null);

      const modelFile = new File(Paths.document, MODEL_FILENAME);
      
      // Check if model exists in documents directory
      if (!modelFile.exists) {
        console.log('Translation model not found, starting download...');
        setStatus('downloading');
        await downloadManager.downloadModel('translation');
        
        // Check download result
        if (downloadManager.translationModel.status === 'error') {
          setError(downloadManager.translationModel.error || 'Failed to download model');
          setStatus('error');
          return;
        }
        
        if (!new File(Paths.document, MODEL_FILENAME).exists) {
          setError('Model download was cancelled or incomplete');
          setStatus('idle');
          return;
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
          console.log('Translation model loading progress:', loadProgress);
        }
      );

      contextRef.current = context;
      setStatus('ready');
      console.log('Model loaded successfully');
    } catch (err) {
      console.error('Failed to initialize model:', err);
      setError(err instanceof Error ? err.message : 'Failed to load translation model');
      setStatus('error');
    } finally {
      isInitializingRef.current = false;
    }
  }, [downloadManager]);

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
        // TranslateGemma prompt format based on Gemma 3 chat template
        // The model expects a specific format for translation tasks
        const prompt = `<bos><start_of_turn>user
Translate from ${sourceLanguage} to ${targetLanguage}:
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
        const result: unknown = await TextRecognition.recognize(imageUri);
        
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
    // Reset initialization flag
    if (isInitializingRef.current) {
      isInitializingRef.current = false;
    }
    
    if (contextRef.current) {
      console.log('Releasing translation model...');
      contextRef.current.release();
      contextRef.current = null;
      setStatus('idle');
      setError(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Reset initialization flag
      if (isInitializingRef.current) {
        isInitializingRef.current = false;
      }
      
      // Release model context (but don't cancel download)
      if (contextRef.current) {
        contextRef.current.release();
        contextRef.current = null;
      }
    };
  }, []);

  // Compute progress from download manager or local status
  const progress = status === 'downloading' ? downloadManager.translationModel.progress : 0;

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
