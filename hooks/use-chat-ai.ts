import { File, Paths } from 'expo-file-system';
import { initLlama, LlamaContext } from 'llama.rn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Model download URL from HuggingFace
const MODEL_DOWNLOAD_URL = 'https://holfun.com/llama-3.2-1b-instruct-q8_0.gguf';
const MODEL_FILENAME = 'llama-3.2-1b-instruct-q8_0.gguf';

export type ChatAIStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error' | 'downloading';

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function useChatAI() {
  const [status, setStatus] = useState<ChatAIStatus>('idle');
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
        console.log('Chat AI model not found, starting download...');
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
          console.log('Downloading chat AI model from:', MODEL_DOWNLOAD_URL);
          
          // Use File.downloadFileAsync to download to the documents directory
          const downloadedFile = await File.downloadFileAsync(MODEL_DOWNLOAD_URL, Paths.document);
          
          clearInterval(progressInterval);
          setProgress(100);
          
          console.log('Chat AI model downloaded successfully to:', downloadedFile.uri);
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
                  ? `Failed to download chat AI model: ${downloadErr.message}`
                  : 'Failed to download chat AI model'
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
      console.log('Loading chat AI model from:', modelPath);

      const context = await initLlama(
        {
          model: modelPath,
          use_mlock: true,
          n_ctx: 4096, // Larger context for conversations
          n_gpu_layers: Platform.OS === 'ios' ? 99 : 0, // Use Metal on iOS
          n_batch: 512,
        },
        (loadProgress) => {
          // Normalize progress value and cap at 100%
          const percentage = Math.min(100, loadProgress > 1 ? Math.round(loadProgress) : Math.round(loadProgress * 100));
          setProgress(percentage);
          console.log('Chat AI model loading progress:', percentage + '%', '(raw:', loadProgress + ')');
        }
      );

      contextRef.current = context;
      setStatus('ready');
      console.log('Chat AI model loaded successfully');
    } catch (err) {
      console.error('Failed to initialize chat AI model:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chat AI model');
      setStatus('error');
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
        let prompt = '<|begin_of_text|>';
        
        for (const message of messages) {
          if (message.role === 'system') {
            prompt += `<|start_header_id|>system<|end_header_id|>\n\n${message.content}<|eot_id|>`;
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
            n_predict: 2048,
            stop: ['<|eot_id|>', '<|end_of_text|>'],
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
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
        console.error('Chat AI generation error:', err);
        setError(err instanceof Error ? err.message : 'Chat generation failed');
        setStatus('error');
        throw err;
      }
    },
    []
  );

  // Release the model manually
  const releaseModel = useCallback(() => {
    if (contextRef.current) {
      console.log('Releasing chat AI model...');
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
    generateResponse,
    releaseModel,
    isReady: status === 'ready',
    isLoading: status === 'loading',
    isGenerating: status === 'generating',
    isDownloading: status === 'downloading',
  };
}
