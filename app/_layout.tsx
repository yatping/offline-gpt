import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';

import { DownloadManagerProvider } from '@/contexts/download-manager-context';
import { TranslationProvider, useTranslationContext } from '@/contexts/translation-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOTAUpdates } from '@/hooks/use-ota-updates';

function AppContent() {
  const colorScheme = useColorScheme();
  const { isDownloading, isLoading, progress } = useTranslationContext();
  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  // Initialize OTA update checking
  useOTAUpdates();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DownloadManagerProvider>
        <TranslationProvider>
          <AppContent />
        </TranslationProvider>
      </DownloadManagerProvider>
    </ThemeProvider>
  );
}