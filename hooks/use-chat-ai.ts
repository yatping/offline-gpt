import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
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
  const isInitializingRef = useRef(false);
  const downloadResumableRef = useRef<FileSystem.DownloadResumable | null>(null);

  // Initialize the model
  const initializeModel = useCallback(async () => {
    if (contextRef.current) {
      return; // Already initialized
    }
    
    if (isInitializingRef.current) {
      console.log('Chat AI initialization already in progress, skipping...');
      return; // Already initializing
    }

    try {
      isInitializingRef.current = true;
      setStatus('loading');
      setError(null);
      setProgress(0);

      const modelFile = new File(Paths.document, MODEL_FILENAME);
      
      // Check if model exists in documents directory
      if (!modelFile.exists) {
        console.log('Chat AI model not found, starting download...');
        setStatus('downloading');
        
        try {
          // Download the model from HuggingFace with real progress tracking
          console.log('Downloading chat AI model from:', MODEL_DOWNLOAD_URL);
          
          const downloadPath = `${FileSystem.documentDirectory}${MODEL_FILENAME}`;
          
          const downloadResumable = FileSystem.createDownloadResumable(
            MODEL_DOWNLOAD_URL,
            downloadPath,
            {},
            (downloadProgress) => {
              const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
              const percentage = Math.round(progress * 100);
              setProgress(percentage);
              console.log('Download progress:', percentage + '%');
            }
          );
          
          // Store the download resumable so it can be cancelled
          downloadResumableRef.current = downloadResumable;
          
          const result = await downloadResumable.downloadAsync();
          
          // Clear the reference after download completes
          downloadResumableRef.current = null;
          
          // If result is null, it might have been cancelled
          if (!result) {
            console.log('Download returned no result - likely cancelled');
            setStatus('idle');
            return;
          }
          
          setProgress(100);
          console.log('Chat AI model downloaded successfully to:', result.uri);
          
        } catch (downloadErr) {
          // Clear the reference on error
          downloadResumableRef.current = null;
          
          // Check if download was cancelled (component unmounted)
          if (downloadErr instanceof Error && downloadErr.message.includes('cancelled')) {
            console.log('Download was cancelled');
            setStatus('idle');
            return;
          }
          
          // Check if the file exists before treating as an error
          console.warn('Download threw error:', downloadErr);
          
          // Re-check if model file exists now
          const recheckFile = new File(Paths.document, MODEL_FILENAME);
          if (!recheckFile.exists) {
            console.error('Download failed:', downloadErr);
            setError(
              downloadErr instanceof Error
                ? `Failed to download chat AI model: ${downloadErr.message}`
                : 'Failed to download chat AI model'
            );
            setStatus('error');
            return;
          } else {
            console.log('File exists despite error, continuing...');
            setProgress(100);
          }
        }
      }

      setStatus('loading');
      
      // Verify file exists before loading
      const finalModelFile = new File(Paths.document, MODEL_FILENAME);
      if (!finalModelFile.exists) {
        throw new Error(`Model file not found at ${finalModelFile.uri}`);
      }
      
      // Check if file is too small (likely corrupted or incomplete)
      const fileSize = finalModelFile.size || 0;
      console.log('Model file size:', fileSize, 'bytes (', (fileSize / 1024 / 1024).toFixed(2), 'MB)');
      
      if (fileSize < 1024 * 1024) { // Less than 1MB is definitely wrong for a model
        console.error('Model file is too small, likely corrupted or incomplete');
        // Delete the corrupted file
        await finalModelFile.delete();
        throw new Error(`Model file is corrupted (only ${(fileSize / 1024).toFixed(2)} KB). Please restart the app to re-download.`);
      }
      
      const modelPath = finalModelFile.uri;
      console.log('Loading chat AI model from:', modelPath);
      console.log('File exists:', finalModelFile.exists);
      console.log('File size:', finalModelFile.size, 'bytes');
      
      // Add more detailed error context
      console.log('Platform:', Platform.OS);
      console.log('Initializing llama with n_gpu_layers:', Platform.OS === 'ios' ? 99 : 0);

      const context = await initLlama(
        {
          model: modelPath,
          use_mlock: true,
          n_ctx: 2048, // Context window for Llama 3.2
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
      // Log more detailed error information
      if (err instanceof Error) {
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
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
    // Cancel any ongoing download
    if (downloadResumableRef.current) {
      console.log('Cancelling chat AI model download...');
      downloadResumableRef.current.pauseAsync().catch(() => {});
      downloadResumableRef.current = null;
    }
    
    // Reset initialization flag
    if (isInitializingRef.current) {
      isInitializingRef.current = false;
    }
    
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
      // Cancel any ongoing download
      if (downloadResumableRef.current) {
        console.log('Unmounting - cancelling chat AI model download...');
        downloadResumableRef.current.pauseAsync().catch(() => {});
        downloadResumableRef.current = null;
      }
      
      // Reset initialization flag
      if (isInitializingRef.current) {
        isInitializingRef.current = false;
      }
      
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
