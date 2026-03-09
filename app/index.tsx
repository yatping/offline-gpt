import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ChatScreen from '@/components/chat-screen';
import { FloatingModeButton } from '@/components/floating-mode-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppMode, loadAppMode, saveAppMode } from '@/utils/app-mode-storage';
import TranslateScreen from '../app/(tabs)/translate';

export default function Index() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [currentMode, setCurrentMode] = useState<AppMode>('chat');
  const [isLoading, setIsLoading] = useState(true);

  // Load the saved mode on mount
  useEffect(() => {
    const loadSavedMode = async () => {
      try {
        const savedMode = await loadAppMode();
        setCurrentMode(savedMode);
      } catch (error) {
        console.error('Failed to load saved app mode:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedMode();
  }, []);

  const toggleMode = async () => {
    const newMode: AppMode = currentMode === 'chat' ? 'translate' : 'chat';
    setCurrentMode(newMode);
    await saveAppMode(newMode);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.container} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {currentMode === 'chat' ? <ChatScreen /> : <TranslateScreen />}
      <FloatingModeButton currentMode={currentMode} onPress={toggleMode} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
