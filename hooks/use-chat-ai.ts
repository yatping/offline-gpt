import { File, Paths } from 'expo-file-system';
import { initLlama, LlamaContext } from 'llama.rn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useDownloadManager } from '../contexts/download-manager-context';

const MODEL_FILENAME = 'LFM2.5-VL-1.6B-Q8_0.gguf';
const MMPROJ_FILENAME = 'mmproj-LFM2.5-VL-1.6b-Q8_0.gguf';

export type ChatAIStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error' | 'downloading';

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function useChatAI() {
  const [status, setStatus] = useState<ChatAIStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<LlamaContext | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const downloadManager = useDownloadManager();

  // Initialize the model
  const initializeModel = useCallback(async () => {
    if (contextRef.current) return;
    if (initPromiseRef.current) return initPromiseRef.current;

    const modelFile = new File(Paths.document, MODEL_FILENAME);
    const mmprojFile = new File(Paths.document, MMPROJ_FILENAME);

    if (!modelFile.exists || !mmprojFile.exists) {
      setStatus('idle');
      return;
    }

    const doInit = async () => {
      let llamaCtx: LlamaContext | null = null;
      try {
        setError(null);
        setStatus('loading');

        const fileSize = modelFile.size || 0;
        if (fileSize < 1024 * 1024) {
          await modelFile.delete();
          throw new Error(`Model file is corrupted (only ${(fileSize / 1024).toFixed(2)} KB). Please restart the app to re-download.`);
        }

        llamaCtx = await initLlama(
          {
            model: modelFile.uri,
            use_mlock: true,
            n_ctx: 4096,
            n_gpu_layers: Platform.OS === 'ios' ? 99 : 0,
            n_batch: 512,
            ctx_shift: false,
          },
          (_loadProgress) => {}
        );

        const multimodalOk = await llamaCtx.initMultimodal({ path: mmprojFile.uri, use_gpu: Platform.OS === 'ios' });
        if (!multimodalOk) {
          throw new Error('Failed to initialize vision support. The mmproj file may be incompatible.');
        }

        contextRef.current = llamaCtx;
        setStatus('ready');
      } catch (err) {
        if (llamaCtx) llamaCtx.release().catch(() => {});
        setError(err instanceof Error ? err.message : 'Failed to load chat AI model');
        setStatus('error');
        throw err;
      } finally {
        initPromiseRef.current = null;
      }
    };

    initPromiseRef.current = doInit();
    return initPromiseRef.current;
  }, []);

  // Generate chat response
  const generateResponse = useCallback(
    async (
      messages: ChatMessage[],
      onPartialResult?: (partial: string) => void
    ): Promise<string> => {
      if (!contextRef.current) {
        throw new Error('Chat AI model not initialized');
      }

      setStatus('generating');

      try {
        // LFM2.5 ChatML format
        let prompt = '<|startoftext|><|im_start|>system\nYou are a helpful and concise assistant.<|im_end|>\n';
        
        for (const message of messages) {
          if (message.role === 'system') continue;
          if (message.role === 'user') {
            prompt += `<|im_start|>user\n${message.content}<|im_end|>\n`;
          } else if (message.role === 'assistant') {
            prompt += `<|im_start|>assistant\n${message.content}<|im_end|>\n`;
          }
        }
        prompt += '<|im_start|>assistant\n';

        let result = '';

        const completionResult = await contextRef.current.completion(
          {
            prompt,
            n_predict: 512,
            stop: ['<|im_end|>', '<|endoftext|>'],
            temperature: 0.7,
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
        setError(err instanceof Error ? err.message : 'Chat generation failed');
        setStatus('error');
        throw err;
      }
    },
    []
  );

  // Generate response with image (vision)
  const generateResponseWithImage = useCallback(
    async (
      imagePath: string,
      prompt: string,
      onPartialResult?: (partial: string) => void
    ): Promise<string> => {
      if (!contextRef.current) {
        throw new Error('Chat AI model not initialized');
      }

      setStatus('generating');

      try {
        let result = '';

        const completionResult = await contextRef.current.completion(
          {
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: imagePath } },
                  { type: 'text', text: prompt },
                ],
              },
            ],
            n_predict: 1024,
            stop: ['<|im_end|>', '<|endoftext|>'],
            temperature: 0.1,
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
        setError(err instanceof Error ? err.message : 'Image generation failed');
        setStatus('error');
        throw err;
      }
    },
    []
  );

  // Release the model manually
  const releaseModel = useCallback(() => {
    initPromiseRef.current = null;
    if (contextRef.current) {
      contextRef.current.release();
      contextRef.current = null;
      setStatus('idle');
      setError(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      initPromiseRef.current = null;
      if (contextRef.current) {
        contextRef.current.release();
        contextRef.current = null;
      }
    };
  }, []);

  // Compute progress from download manager or local status
  const progress = status === 'downloading' ? downloadManager.chatModel.progress : 0;

  return {
    status,
    error,
    progress,
    initializeModel,
    generateResponse,
    generateResponseWithImage,
    releaseModel,
    isReady: status === 'ready',
    isLoading: status === 'loading',
    isGenerating: status === 'generating',
    isDownloading: status === 'downloading',
  };
}
