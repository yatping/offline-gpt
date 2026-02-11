import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { TranslationProvider, useTranslationContext } from '@/contexts/translation-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppContent() {
  const colorScheme = useColorScheme();
  const { isDownloading, isLoading, progress } = useTranslationContext();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
      
      {(isDownloading || isLoading) && (
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.overlayTitle}>
            {isDownloading ? 'Downloading AI Translation Model...' : 'Loading AI Translation Model...'}
          </ThemedText>
          {isDownloading && (
            <ThemedText style={styles.overlaySubtext}>
              This may take a few minutes (2.2 GB)
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <TranslationProvider>
        <AppContent />
      </TranslationProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    gap: 16,
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  overlaySubtext: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 8,
  },
});
