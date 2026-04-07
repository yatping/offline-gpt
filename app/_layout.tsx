import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { DownloadManagerProvider } from '@/contexts/download-manager-context';
import { TranslationProvider } from '@/contexts/translation-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOTAUpdates } from '@/hooks/use-ota-updates';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function AppContent() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  
  // Initialize OTA update checking
  useOTAUpdates();

  useEffect(() => {
    async function prepare() {
      try {
        // Perform any app initialization here (fonts, assets, etc.)
        // For now, just mark as ready
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Hide splash screen once app is ready
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DownloadManagerProvider>
        <TranslationProvider>
          <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <AppContent />
          </View>
        </TranslationProvider>
      </DownloadManagerProvider>
    </ThemeProvider>
  );
}