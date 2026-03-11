import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

/**
 * Manually check for updates and prompt user to restart if available
 * Useful for "Check for Updates" buttons in settings
 */
export async function manualUpdateCheck(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) {
    Alert.alert('Development Mode', 'Updates are only available in production builds');
    return;
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    
    if (update.isAvailable) {
      Alert.alert(
        'Update Available',
        'Downloading update...',
        [{ text: 'OK' }]
      );
      
      const fetchResult = await Updates.fetchUpdateAsync();
      
      if (fetchResult.isNew) {
        Alert.alert(
          'Update Ready',
          'Would you like to restart the app to apply the update?',
          [
            { text: 'Later', style: 'cancel' },
            { 
              text: 'Restart Now',
              onPress: async () => await Updates.reloadAsync()
            },
          ]
        );
      }
    } else {
      Alert.alert('Up to Date', 'You are already running the latest version');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to check for updates. Please try again later.');
  }
}

/**
 * Get current update information
 */
export function getUpdateInfo() {
  return {
    updateId: Updates.updateId,
    createdAt: Updates.createdAt,
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    isEmergencyLaunch: Updates.isEmergencyLaunch,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isEnabled: Updates.isEnabled,
  };
}

/**
 * Reload the app with the latest update
 */
export async function reloadApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch (error) {
    Alert.alert('Error', 'Failed to reload the app');
  }
}
