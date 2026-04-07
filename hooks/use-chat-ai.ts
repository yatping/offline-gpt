import { File, Paths } from 'expo-file-system';
import { initLlama, LlamaContext } from 'llama.rn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useDownloadManager } from '../contexts/download-manager-context';

const MODEL_FILENAME = 'llama-3.2-1b-instruct-q8_0.gguf';

export type ChatAIStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error' | 'downloading';

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function useChatAI() {
  const [status, setStatus] = useState<ChatAIStatus>('idle');
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
      return; // Already initializing
    }

    try {
      isInitializingRef.current = true;
      setError(null);

      const modelFile = new File(Paths.document, MODEL_FILENAME);

      // Only initialize if the model is already downloaded
      if (!modelFile.exists) {
        setStatus('idle');
        return;
      }

      setStatus('loading');
      
      // Verify file exists before loading
      const finalModelFile = new File(Paths.document, MODEL_FILENAME);
      if (!finalModelFile.exists) {
        throw new Error(`Model file not found at ${finalModelFile.uri}`);
      }
      
      // Check if file is too small (likely corrupted or incomplete)
      const fileSize = finalModelFile.size || 0;
      
      if (fileSize < 1024 * 1024) { // Less than 1MB is definitely wrong for a model
        // Delete the corrupted file
        await finalModelFile.delete();
        throw new Error(`Model file is corrupted (only ${(fileSize / 1024).toFixed(2)} KB). Please restart the app to re-download.`);
      }
      
      const modelPath = finalModelFile.uri;
      
      // Add more detailed error context

      const context = await initLlama(
        {
          model: modelPath,
          use_mlock: true,
          n_ctx: 2048, // Context window for Llama 3.2
          n_gpu_layers: Platform.OS === 'ios' ? 99 : 0, // Use Metal on iOS
          n_batch: 512,
        },
        (loadProgress) => {
          // Model loading progress
        }
      );

      contextRef.current = context;
      setStatus('ready');
    } catch (err) {
      // Log more detailed error information
      if (err instanceof Error) {
      }
      setError(err instanceof Error ? err.message : 'Failed to load chat AI model');
      setStatus('error');
    } finally {
      isInitializingRef.current = false;
    }
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
        // Llama 3.2 Instruct chat template
        let prompt = '<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are a helpful and concise assistant. Answer directly without overthinking.<|eot_id|>';
        
        for (const message of messages) {
          if (message.role === 'system') {
            // System message already added above, skip duplicates
            continue;
          } else if (message.role === 'user') {
            prompt += `<|start_header_id|>user<|end_header_id|>\n\n${message.content}<|eot_id|>`;
          } else if (message.role === 'assistant') {
            prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n${message.content}<|eot_id|>`;
          }
        }
        
        // Add the assistant tag to prompt for the response
        prompt += '<|start_header_id|>assistant<|end_header_id|>\n\n';

        let result = '';

        const completionResult = await contextRef.current.completion(
          {
            prompt,
            n_predict: 512,
            stop: ['<|eot_id|>', '<|end_of_text|>'],
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

  // Release the model manually
  const releaseModel = useCallback(() => {
    // Reset initialization flag
    if (isInitializingRef.current) {
      isInitializingRef.current = false;
    }
    
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
  const progress = status === 'downloading' ? downloadManager.chatModel.progress : 0;

  return {
    status,
    error,
    progress,
    initializeModel,
    generateResponse,
    releaseModel,
    isReady: status === 'ready',
    isLoading: status === 'loading',
    isGenerating: status === 'generating',
    isDownloading: status === 'downloading',
  };
}
