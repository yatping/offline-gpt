import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModelDownloadPage } from '@/components/model-download-page';
import { ThemedText } from '@/components/themed-text';
import { useDownloadManager } from '@/contexts/download-manager-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function ModelDownloadOverlay() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { chatModel, showPrompt } = useDownloadManager();

  const isDownloading = chatModel.status === 'downloading';
  // Banner only shows when downloading in background (full page was dismissed)
  const showBanner = isDownloading && !showPrompt;

  return (
    <>
      <ModelDownloadPage />

      {showBanner && (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: '#191919',
              paddingTop: insets.top + 10,
            },
          ]}
        >
          <View style={styles.bannerRow}>
            <ThemedText style={styles.bannerText}>
              Downloading AI model… {chatModel.progress}%
            </ThemedText>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${chatModel.progress}%` },
              ]}
            />
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});
