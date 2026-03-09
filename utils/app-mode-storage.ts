import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_MODE_KEY = '@offline_translate:app_mode';

export type AppMode = 'chat' | 'translate';

/**
 * Save the current app mode
 */
export async function saveAppMode(mode: AppMode): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_MODE_KEY, mode);
  } catch (error) {
    console.error('Failed to save app mode:', error);
  }
}

/**
 * Load the saved app mode
 * Returns 'chat' as default if no mode is saved
 */
export async function loadAppMode(): Promise<AppMode> {
  try {
    const mode = await AsyncStorage.getItem(APP_MODE_KEY);
    return (mode as AppMode) || 'chat';
  } catch (error) {
    console.error('Failed to load app mode:', error);
    return 'chat';
  }
}
