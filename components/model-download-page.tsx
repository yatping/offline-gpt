import { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useDownloadManager } from '@/contexts/download-manager-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const DOTS = 16;
const RADIUS = 50;
const DOT_SIZE = 6;

function DownloadRingIcon({ color }: { color: string }) {
  const containerSize = RADIUS * 2 + DOT_SIZE * 4;
  return (
    <View style={{ width: containerSize, height: containerSize, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: DOTS }).map((_, i) => {
        const angle = (i / DOTS) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * RADIUS;
        const y = Math.sin(angle) * RADIUS;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              backgroundColor: color,
              opacity: 0.15 + (i / DOTS) * 0.7,
              transform: [{ translateX: x }, { translateY: y }],
            }}
          />
        );
      })}
      <IconSymbol name="arrow.down" size={30} color={color} />
    </View>
  );
}

export function ModelDownloadPage() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const { chatModel, showPrompt, downloadModel, cancelDownload, dismissPrompt } = useDownloadManager();

  const isDownloading = chatModel.status === 'downloading';
  const isError = chatModel.status === 'error';

  // Auto-dismiss when download completes
  useEffect(() => {
    if (chatModel.status === 'completed' && showPrompt) {
      dismissPrompt();
    }
  }, [chatModel.status, showPrompt, dismissPrompt]);

  if (!showPrompt) return null;

  const bg = isDark ? '#191919' : '#ffffff';
  const cardBg = isDark ? '#242424' : '#f5f5f5';
  const cardBorder = isDark ? '#2e2e2e' : '#e8e8e8';
  const iconFg = isDark ? '#000000' : '#ffffff';

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: bg, zIndex: 100 }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <DownloadRingIcon color={colors.text} />

          <ThemedText style={styles.title}>Download AI Model</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            This app requires a ~1.4 GB AI model for offline use. Download it now for the best experience.
          </ThemedText>

          {isError && (
            <ThemedText style={styles.errorText}>
              Download failed. Please try again.
            </ThemedText>
          )}

          {isDownloading && (
            <View style={[styles.progressCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.progressHeader}>
                <ThemedText style={[styles.progressLabel, { color: colors.icon }]}>Downloading…</ThemedText>
                <ThemedText style={[styles.progressPct, { color: colors.text }]}>
                  {chatModel.progress}%
                </ThemedText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: isDark ? '#333' : '#e0e0e0' }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${chatModel.progress}%`, backgroundColor: colors.tint },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <ThemedText style={[styles.hint, { color: colors.icon }]}>
            Please keep the app open during download.
          </ThemedText>

          {isDownloading ? (
            <>
              <TouchableOpacity
                style={[styles.button, { borderWidth: 1.5, borderColor: cardBorder }]}
                onPress={() => cancelDownload('chat')}
                activeOpacity={0.8}>
                <ThemedText style={[styles.buttonText, { color: colors.text }]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipButton} onPress={dismissPrompt} activeOpacity={0.7}>
                <ThemedText style={[styles.skipText, { color: colors.icon }]}>
                  Continue in background
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.tint }]}
                onPress={() => downloadModel('chat')}
                activeOpacity={0.85}>
                <IconSymbol name="arrow.down.circle" size={20} color={iconFg} />
                <ThemedText style={[styles.buttonText, { color: iconFg }]}>
                  Download  (1.47 GB)
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipButton} onPress={dismissPrompt} activeOpacity={0.7}>
                <ThemedText style={[styles.skipText, { color: colors.text }]}>Skip</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#e53935',
    marginBottom: 8,
  },
  progressCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 50,
    paddingVertical: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
