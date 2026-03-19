import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type ModelType = 'translation' | 'chat';

type ModelDownloadState = {
  status: 'idle' | 'downloading' | 'completed' | 'error';
  progress: number;
  error: string | null;
};

type DownloadManagerContextType = {
  translationModel: ModelDownloadState;
  chatModel: ModelDownloadState;
  downloadModel: (type: ModelType) => Promise<void>;
  cancelDownload: (type: ModelType) => void;
  isModelDownloaded: (type: ModelType) => boolean;
};

const MODEL_CONFIGS = {
  translation: {
    url: 'https://orangolabs.com/translategemma-4b-it.Q4_K_S.gguf',
    filename: 'translategemma-4b-it.Q4_K_S.gguf',
  },
  chat: {
    url: 'https://orangolabs.com/llama-3.2-1b-instruct-q8_0.gguf',
    filename: 'llama-3.2-1b-instruct-q8_0.gguf',
  },
};

const DownloadManagerContext = createContext<DownloadManagerContextType | null>(null);

export function DownloadManagerProvider({ children }: { children: React.ReactNode }) {
  const [translationModel, setTranslationModel] = useState<ModelDownloadState>({
    status: 'idle',
    progress: 0,
    error: null,
  });

  const [chatModel, setChatModel] = useState<ModelDownloadState>({
    status: 'idle',
    progress: 0,
    error: null,
  });

  const downloadResumablesRef = useRef<{
    translation: FileSystem.DownloadResumable | null;
    chat: FileSystem.DownloadResumable | null;
  }>({
    translation: null,
    chat: null,
  });

  const isModelDownloaded = (type: ModelType): boolean => {
    const config = MODEL_CONFIGS[type];
    const modelFile = new File(Paths.document, config.filename);
    return modelFile.exists;
  };

  const downloadModel = async (type: ModelType) => {
    const config = MODEL_CONFIGS[type];
    const setState = type === 'translation' ? setTranslationModel : setChatModel;

    // Check if already downloaded
    if (isModelDownloaded(type)) {
      setState({ status: 'completed', progress: 100, error: null });
      return;
    }

    // Check if already downloading
    const currentState = type === 'translation' ? translationModel : chatModel;
    if (currentState.status === 'downloading') {
      console.log(`${type} model already downloading, skipping...`);
      return;
    }

    try {
      setState({ status: 'downloading', progress: 0, error: null });

      const downloadPath = `${FileSystem.documentDirectory}${config.filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        config.url,
        downloadPath,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          const percentage = Math.round(progress * 100);
          setState((prev) => ({ ...prev, progress: percentage }));
          console.log(`${type} model download progress: ${percentage}%`);
        }
      );

      downloadResumablesRef.current[type] = downloadResumable;

      const result = await downloadResumable.downloadAsync();

      downloadResumablesRef.current[type] = null;

      if (!result) {
        console.log(`${type} model download cancelled`);
        setState({ status: 'idle', progress: 0, error: null });
        return;
      }

      setState({ status: 'completed', progress: 100, error: null });
      console.log(`${type} model downloaded successfully to:`, result.uri);
    } catch (err) {
      downloadResumablesRef.current[type] = null;

      if (err instanceof Error && err.message.includes('cancelled')) {
        console.log(`${type} model download was cancelled`);
        setState({ status: 'idle', progress: 0, error: null });
        return;
      }

      // Check if file exists despite error
      const recheckFile = new File(Paths.document, config.filename);
      if (recheckFile.exists) {
        console.log(`${type} model file exists despite error, marking as completed`);
        setState({ status: 'completed', progress: 100, error: null });
      } else {
        console.error(`${type} model download failed:`, err);
        setState({
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
      const setState = type === 'translation' ? setTranslationModel : setChatModel;
      setState({ status: 'idle', progress: 0, error: null });
    }
  };

  // Check initial state of models
  useEffect(() => {
    if (isModelDownloaded('translation')) {
      setTranslationModel({ status: 'completed', progress: 100, error: null });
    }
    if (isModelDownloaded('chat')) {
      setChatModel({ status: 'completed', progress: 100, error: null });
    }
  }, []);

  // Cleanup on unmount (only when app is truly closing)
  useEffect(() => {
    return () => {
      if (downloadResumablesRef.current.translation) {
        downloadResumablesRef.current.translation.pauseAsync().catch(() => {});
      }
      if (downloadResumablesRef.current.chat) {
        downloadResumablesRef.current.chat.pauseAsync().catch(() => {});
      }
    };
  }, []);

  return (
    <DownloadManagerContext.Provider
      value={{
        translationModel,
        chatModel,
        downloadModel,
        cancelDownload,
        isModelDownloaded,
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
