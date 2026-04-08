import { File, Paths } from 'expo-file-system';
import { initLlama, LlamaContext } from 'llama.rn';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useDownloadManager } from './download-manager-context';

const MODEL_FILENAME = 'LFM2.5-VL-1.6B-Q8_0.gguf';
const MMPROJ_FILENAME = 'mmproj-LFM2.5-VL-1.6b-Q8_0.gguf';

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
  generateResponseWithImage: (
    imagePath: string,
    prompt: string,
    onPartialResult?: (partial: string) => void
  ) => Promise<string>;
};

const ChatAIContext = createContext<ChatAIContextType | null>(null);

export function ChatAIProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ChatAIStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<LlamaContext | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const { chatModel, resetDownload } = useDownloadManager();

  const initializeModel = useCallback(async () => {
    if (contextRef.current) return;
    // Return the in-flight promise so all concurrent callers wait on the same init
    if (initPromiseRef.current) return initPromiseRef.current;

    const modelFile = new File(Paths.document, MODEL_FILENAME);
    const mmprojFile = new File(Paths.document, MMPROJ_FILENAME);
    if (!modelFile.exists || !mmprojFile.exists) return;

    const doInit = async () => {
      let llamaCtx: LlamaContext | null = null;
      try {
        setError(null);
        setStatus('loading');

        const fileSize = modelFile.size ?? 0;
        if (fileSize < 1024 * 1024) {
          try { modelFile.delete(); } catch {}
          resetDownload('chat');
          throw new Error('Model file appears corrupted. Please re-download.');
        }

        const mmprojSize = mmprojFile.size ?? 0;
        if (mmprojSize < 1024 * 1024) {
          try { mmprojFile.delete(); } catch {}
          resetDownload('chat');
          throw new Error('Mmproj file appears corrupted. Please re-download.');
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
          () => {}
        );

        const multimodalOk = await llamaCtx.initMultimodal({ path: mmprojFile.uri, use_gpu: Platform.OS === 'ios' });
        if (!multimodalOk) {
          try { mmprojFile.delete(); } catch {}
          resetDownload('chat');
          throw new Error('Failed to initialize vision support. The mmproj file may be incompatible.');
        }

        contextRef.current = llamaCtx;
        setStatus('ready');
      } catch (err) {
        if (llamaCtx) {
          llamaCtx.release().catch(() => {});
        }
        setError(err instanceof Error ? err.message : 'Failed to load AI model');
        setStatus('error');
        throw err;
      } finally {
        initPromiseRef.current = null;
      }
    };

    initPromiseRef.current = doInit();
    return initPromiseRef.current;
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
        // Use caller-supplied system message if present, otherwise fall back to default
        const systemMessage = messages.find(m => m.role === 'system')?.content
          ?? 'You are a helpful and concise assistant.';
        let prompt = `<|startoftext|><|im_start|>system\n${systemMessage}<|im_end|>\n`;

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
        setError(err instanceof Error ? err.message : 'Generation failed');
        setStatus('error');
        throw err;
      }
    },
    []
  );

  const generateResponseWithImage = useCallback(
    async (
      imagePath: string,
      prompt: string,
      onPartialResult?: (partial: string) => void
    ): Promise<string> => {
      if (!contextRef.current) {
        throw new Error('AI model not ready');
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
        generateResponseWithImage,
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
