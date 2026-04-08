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
  resetDownload: (type: ModelType) => void;
  isModelDownloaded: (type: ModelType) => boolean;
  showPrompt: boolean;
  dismissPrompt: () => void;
  acceptPrompt: () => void;
};

const MODEL_CONFIGS = {
  chat: {
    model: {
      url: 'https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B-GGUF/resolve/main/LFM2.5-VL-1.6B-Q8_0.gguf',
      filename: 'LFM2.5-VL-1.6B-Q8_0.gguf',
    },
    mmproj: {
      url: 'https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B-GGUF/resolve/main/mmproj-LFM2.5-VL-1.6b-Q8_0.gguf',
      filename: 'mmproj-LFM2.5-VL-1.6b-Q8_0.gguf',
    },
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
    chatMmproj: FileSystem.DownloadResumable | null;
  }>({
    chat: null,
    chatMmproj: null,
  });

  const isModelDownloaded = (type: ModelType): boolean => {
    const config = MODEL_CONFIGS[type];
    const modelFile = new File(Paths.document, config.model.filename);
    const mmprojFile = new File(Paths.document, config.mmproj.filename);
    return modelFile.exists && mmprojFile.exists;
  };

  const downloadModel = async (type: ModelType) => {
    const config = MODEL_CONFIGS[type];

    if (isModelDownloaded(type)) {
      setChatModel({ status: 'completed', progress: 100, error: null });
      return;
    }

    if (chatModel.status === 'downloading') {
      console.log(`${type} model already downloading, skipping...`);
      return;
    }

    // Track which file is actively downloading for targeted cleanup on error
    let downloadingFile: 'model' | 'mmproj' = 'model';

    try {
      setChatModel({ status: 'downloading', progress: 0, error: null });

      // Download main model (counts as 0–80% of progress)
      const modelPath = `${FileSystem.documentDirectory}${config.model.filename}`;
      const modelFile = new File(Paths.document, config.model.filename);

      if (!modelFile.exists) {
        const modelResumable = FileSystem.createDownloadResumable(
          config.model.url,
          modelPath,
          {},
          (downloadProgress) => {
            const progress =
              downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            const percentage = Math.round(progress * 80); // 0–80%
            setChatModel((prev) => ({ ...prev, progress: percentage }));
          }
        );
        downloadResumablesRef.current[type] = modelResumable;
        const modelResult = await modelResumable.downloadAsync();
        downloadResumablesRef.current[type] = null;

        if (!modelResult) {
          // Clean up any partial file before returning
          const partialModel = new File(Paths.document, config.model.filename);
          try { if (partialModel.exists) partialModel.delete(); } catch {}
          setChatModel({ status: 'idle', progress: 0, error: null });
          return;
        }
      }

      setChatModel((prev) => ({ ...prev, progress: 80 }));
      downloadingFile = 'mmproj';

      // Download mmproj (counts as 80–100% of progress)
      const mmprojPath = `${FileSystem.documentDirectory}${config.mmproj.filename}`;
      const mmprojFile = new File(Paths.document, config.mmproj.filename);

      if (!mmprojFile.exists) {
        const mmprojResumable = FileSystem.createDownloadResumable(
          config.mmproj.url,
          mmprojPath,
          {},
          (downloadProgress) => {
            const progress =
              downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            const percentage = 80 + Math.round(progress * 20); // 80–100%
            setChatModel((prev) => ({ ...prev, progress: percentage }));
          }
        );
        downloadResumablesRef.current.chatMmproj = mmprojResumable;
        const mmprojResult = await mmprojResumable.downloadAsync();
        downloadResumablesRef.current.chatMmproj = null;

        if (!mmprojResult) {
          // Clean up partial mmproj file before returning
          const partialMmproj = new File(Paths.document, config.mmproj.filename);
          try { if (partialMmproj.exists) partialMmproj.delete(); } catch {}
          setChatModel({ status: 'idle', progress: 0, error: null });
          return;
        }
      }

      setChatModel({ status: 'completed', progress: 100, error: null });
      console.log(`${type} model + mmproj downloaded successfully`);
    } catch (err) {
      downloadResumablesRef.current[type] = null;
      downloadResumablesRef.current.chatMmproj = null;

      // Only delete the partial file that was actively downloading
      const partialModel = new File(Paths.document, config.model.filename);
      const partialMmproj = new File(Paths.document, config.mmproj.filename);
      const deletePartial = () => {
        if (downloadingFile === 'model') {
          try { if (partialModel.exists) partialModel.delete(); } catch {}
        } else {
          try { if (partialMmproj.exists) partialMmproj.delete(); } catch {}
        }
      };

      if (err instanceof Error && err.message.includes('cancelled')) {
        deletePartial();
        setChatModel({ status: 'idle', progress: 0, error: null });
        return;
      }

      if (isModelDownloaded(type)) {
        setChatModel({ status: 'completed', progress: 100, error: null });
      } else {
        deletePartial();
        console.error(`${type} model download failed:`, err);
        setChatModel({
          status: 'error',
          progress: 0,
          error: err instanceof Error ? err.message : 'Download failed',
        });
      }
    }
  };

  // Resets download state to idle without deleting files.
  // Call this after deleting a specific bad file so the user can re-download.
  const resetDownload = (_type: ModelType) => {
    setChatModel({ status: 'idle', progress: 0, error: null });
  };

  const cancelDownload = (type: ModelType) => {
    const config = MODEL_CONFIGS[type];
    const downloadResumable = downloadResumablesRef.current[type];
    if (downloadResumable) {
      console.log(`Cancelling ${type} model download...`);
      downloadResumable.pauseAsync().catch(() => {});
      downloadResumablesRef.current[type] = null;
    }
    if (downloadResumablesRef.current.chatMmproj) {
      downloadResumablesRef.current.chatMmproj.pauseAsync().catch(() => {});
      downloadResumablesRef.current.chatMmproj = null;
      // Partial mmproj — delete synchronously before state update to close race window
      try { new File(Paths.document, config.mmproj.filename).delete(); } catch {}
    } else {
      // Still in model-download phase; partial model may exist
      try { new File(Paths.document, config.model.filename).delete(); } catch {}
    }
    setChatModel({ status: 'idle', progress: 0, error: null });
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
      if (downloadResumablesRef.current.chatMmproj) {
        downloadResumablesRef.current.chatMmproj.pauseAsync().catch(() => {});
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
        resetDownload,
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

/** Returns true when the global download banner is visible (model missing or downloading). */
export function useBannerVisible(): boolean {
  const { chatModel, showPrompt } = useDownloadManager();
  const isDownloading = chatModel.status === 'downloading';
  const isNotDownloaded = chatModel.status === 'idle' || chatModel.status === 'error';
  return isDownloading || (isNotDownloaded && !showPrompt);
}
