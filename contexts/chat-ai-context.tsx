import { File, Paths } from 'expo-file-system';
import { initLlama, LlamaContext } from 'llama.rn';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useDownloadManager } from './download-manager-context';

const MODEL_FILENAME = 'llama-3.2-1b-instruct-q8_0.gguf';

export type ChatAIStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ChatAIContextType = {
  status: ChatAIStatus;
  error: string | null;
  isReady: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  initializeModel: () => Promise<void>;
  generateResponse: (
    messages: ChatMessage[],
    onPartialResult?: (partial: string) => void
  ) => Promise<string>;
};

const ChatAIContext = createContext<ChatAIContextType | null>(null);

export function ChatAIProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ChatAIStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<LlamaContext | null>(null);
  const isInitializingRef = useRef(false);

  const { chatModel } = useDownloadManager();

  const initializeModel = useCallback(async () => {
    if (contextRef.current) return;
    if (isInitializingRef.current) return;

    const modelFile = new File(Paths.document, MODEL_FILENAME);
    if (!modelFile.exists) return;

    try {
      isInitializingRef.current = true;
      setError(null);
      setStatus('loading');

      const fileSize = modelFile.size ?? 0;
      if (fileSize < 1024 * 1024) {
        await modelFile.delete();
        throw new Error('Model file appears corrupted. Please re-download.');
      }

      const context = await initLlama(
        {
          model: modelFile.uri,
          use_mlock: true,
          n_ctx: 2048,
          n_gpu_layers: Platform.OS === 'ios' ? 99 : 0,
          n_batch: 512,
        },
        () => {}
      );

      contextRef.current = context;
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI model');
      setStatus('error');
    } finally {
      isInitializingRef.current = false;
    }
  }, []);

  // Auto-initialize when model becomes available (downloaded or already present)
  useEffect(() => {
    if (chatModel.status === 'completed') {
      initializeModel();
    }
  }, [chatModel.status, initializeModel]);

  const generateResponse = useCallback(
    async (
      messages: ChatMessage[],
      onPartialResult?: (partial: string) => void
    ): Promise<string> => {
      if (!contextRef.current) {
        throw new Error('AI model not ready');
      }

      setStatus('generating');

      try {
        let prompt =
          '<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are a helpful and concise assistant. Answer directly without overthinking.<|eot_id|>';

        for (const message of messages) {
          if (message.role === 'system') continue;
          if (message.role === 'user') {
            prompt += `<|start_header_id|>user<|end_header_id|>\n\n${message.content}<|eot_id|>`;
          } else if (message.role === 'assistant') {
            prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n${message.content}<|eot_id|>`;
          }
        }
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
        setError(err instanceof Error ? err.message : 'Generation failed');
        setStatus('error');
        throw err;
      }
    },
    []
  );

  return (
    <ChatAIContext.Provider
      value={{
        status,
        error,
        isReady: status === 'ready',
        isLoading: status === 'loading',
        isGenerating: status === 'generating',
        initializeModel,
        generateResponse,
      }}>
      {children}
    </ChatAIContext.Provider>
  );
}

export function useChatAIContext(): ChatAIContextType {
  const ctx = useContext(ChatAIContext);
  if (!ctx) throw new Error('useChatAIContext must be used within ChatAIProvider');
  return ctx;
}
