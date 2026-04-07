import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type ModelType = 'chat';

type ModelDownloadState = {
  status: 'idle' | 'downloading' | 'completed' | 'error';
  progress: number;
  error: string | null;
};

type DownloadManagerContextType = {
  chatModel: ModelDownloadState;
  downloadModel: (type: ModelType) => Promise<void>;
  cancelDownload: (type: ModelType) => void;
  isModelDownloaded: (type: ModelType) => boolean;
  showPrompt: boolean;
  dismissPrompt: () => void;
  acceptPrompt: () => void;
};

const MODEL_CONFIGS = {
  chat: {
    url: 'https://offlinegpt-assets.orangolabs.com/llama-3.2-1b-instruct-q8_0.gguf',
    filename: 'llama-3.2-1b-instruct-q8_0.gguf',
  },
};

const DownloadManagerContext = createContext<DownloadManagerContextType | null>(null);

export function DownloadManagerProvider({ children }: { children: React.ReactNode }) {
  const [chatModel, setChatModel] = useState<ModelDownloadState>({
    status: 'idle',
    progress: 0,
    error: null,
  });

  const [showPrompt, setShowPrompt] = useState(false);

  const downloadResumablesRef = useRef<{
    chat: FileSystem.DownloadResumable | null;
  }>({
    chat: null,
  });

  const isModelDownloaded = (type: ModelType): boolean => {
    const config = MODEL_CONFIGS[type];
    const modelFile = new File(Paths.document, config.filename);
    return modelFile.exists;
  };

  const downloadModel = async (type: ModelType) => {
    const config = MODEL_CONFIGS[type];

    // Check if already downloaded
    if (isModelDownloaded(type)) {
      setChatModel({ status: 'completed', progress: 100, error: null });
      return;
    }

    // Check if already downloading
    if (chatModel.status === 'downloading') {
      console.log(`${type} model already downloading, skipping...`);
      return;
    }

    try {
      setChatModel({ status: 'downloading', progress: 0, error: null });

      const downloadPath = `${FileSystem.documentDirectory}${config.filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        config.url,
        downloadPath,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          const percentage = Math.round(progress * 100);
          setChatModel((prev) => ({ ...prev, progress: percentage }));
          console.log(`${type} model download progress: ${percentage}%`);
        }
      );

      downloadResumablesRef.current[type] = downloadResumable;

      const result = await downloadResumable.downloadAsync();

      downloadResumablesRef.current[type] = null;

      if (!result) {
        console.log(`${type} model download cancelled`);
        setChatModel({ status: 'idle', progress: 0, error: null });
        return;
      }

      setChatModel({ status: 'completed', progress: 100, error: null });
      console.log(`${type} model downloaded successfully to:`, result.uri);
    } catch (err) {
      downloadResumablesRef.current[type] = null;

      if (err instanceof Error && err.message.includes('cancelled')) {
        console.log(`${type} model download was cancelled`);
        setChatModel({ status: 'idle', progress: 0, error: null });
        return;
      }

      // Check if file exists despite error
      const recheckFile = new File(Paths.document, MODEL_CONFIGS[type].filename);
      if (recheckFile.exists) {
        console.log(`${type} model file exists despite error, marking as completed`);
        setChatModel({ status: 'completed', progress: 100, error: null });
      } else {
        console.error(`${type} model download failed:`, err);
        setChatModel({
          status: 'error',
          progress: 0,
          error: err instanceof Error ? err.message : 'Download failed',
        });
      }
    }
  };

  const cancelDownload = (type: ModelType) => {
    const downloadResumable = downloadResumablesRef.current[type];
    if (downloadResumable) {
      console.log(`Cancelling ${type} model download...`);
      downloadResumable.pauseAsync().catch(() => {});
      downloadResumablesRef.current[type] = null;
      setChatModel({ status: 'idle', progress: 0, error: null });
    }
  };

  // Check initial state of models
  useEffect(() => {
    if (isModelDownloaded('chat')) {
      setChatModel({ status: 'completed', progress: 100, error: null });
    } else {
      // Show download prompt on app open if model is missing
      setShowPrompt(true);
    }
  }, []);

  // Cleanup on unmount (only when app is truly closing)
  useEffect(() => {
    return () => {
      if (downloadResumablesRef.current.chat) {
        downloadResumablesRef.current.chat.pauseAsync().catch(() => {});
      }
    };
  }, []);

  const dismissPrompt = () => setShowPrompt(false);

  const acceptPrompt = () => {
    setShowPrompt(false);
    downloadModel('chat');
  };

  return (
    <DownloadManagerContext.Provider
      value={{
        chatModel,
        downloadModel,
        cancelDownload,
        isModelDownloaded,
        showPrompt,
        dismissPrompt,
        acceptPrompt,
      }}
    >
      {children}
    </DownloadManagerContext.Provider>
  );
}

export function useDownloadManager() {
  const context = useContext(DownloadManagerContext);
  if (!context) {
    throw new Error('useDownloadManager must be used within DownloadManagerProvider');
  }
  return context;
}
