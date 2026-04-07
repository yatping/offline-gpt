import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { DownloadPromptModal } from '@/components/download-prompt-modal';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useDownloadManager } from '@/contexts/download-manager-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function ModelDownloadOverlay() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { chatModel, showPrompt, dismissPrompt, acceptPrompt, downloadModel } = useDownloadManager();

  const isDownloading = chatModel.status === 'downloading';
  const isNotDownloaded = chatModel.status === 'idle' || chatModel.status === 'error';
  const showBanner = isDownloading || (isNotDownloaded && !showPrompt);

  return (
    <>
      <DownloadPromptModal
        visible={showPrompt}
        title="Download AI Model"
        description="This app requires a ~1.4 GB AI model for offline use. Download it now for the best experience."
        warning="Without the model, chat and translation features won't work offline."
        onConfirm={acceptPrompt}
        onCancel={dismissPrompt}
      />

      {showBanner && (
        <TouchableOpacity
          activeOpacity={isDownloading ? 1 : 0.8}
          style={[styles.banner, { backgroundColor: isDownloading ? colors.tint : '#ff9800' }]}
          onPress={isDownloading ? undefined : () => downloadModel('chat')}
        >
          <View style={styles.bannerContent}>
            <IconSymbol
              name={isDownloading ? 'arrow.down.circle' : 'exclamationmark.triangle.fill'}
              size={18}
              color="#fff"
            />
            <ThemedText style={styles.bannerText}>
              {isDownloading
                ? `Downloading AI model… ${chatModel.progress}%`
                : 'AI model not downloaded. Tap to download.'}
            </ThemedText>
          </View>
          {isDownloading && (
            <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${chatModel.progress}%`, backgroundColor: '#fff' },
                ]}
              />
            </View>
          )}
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
