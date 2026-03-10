import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

export function useOTAUpdates() {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const checkForUpdates = useCallback(async (showAlerts = false) => {
    // Skip in development mode
    if (__DEV__ || !Updates.isEnabled) {
      console.log('[OTA] Updates disabled in development mode');
      return;
    }

    try {
      setIsChecking(true);
      console.log('[OTA] Checking for updates...');
      
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        console.log('[OTA] Update available, downloading...');
        setIsDownloading(true);
        
        // Fetch the update
        const fetchResult = await Updates.fetchUpdateAsync();
        
        if (fetchResult.isNew) {
          console.log('[OTA] New update downloaded successfully');
          
          // Show alert to user
          Alert.alert(
            'Update Ready',
            'A new version has been downloaded. Restart the app to apply the update?',
            [
              {
                text: 'Later',
                style: 'cancel',
                onPress: () => console.log('[OTA] Update postponed'),
              },
              {
                text: 'Restart Now',
                onPress: async () => {
                  console.log('[OTA] Reloading app with new update');
                  await Updates.reloadAsync();
                },
              },
            ],
            { cancelable: false }
          );
        }
      } else {
        console.log('[OTA] No updates available');
        if (showAlerts) {
          Alert.alert('Up to Date', 'You are running the latest version');
        }
      }
    } catch (error) {
      console.error('[OTA] Error checking for updates:', error);
      if (showAlerts) {
        Alert.alert('Update Error', 'Failed to check for updates. Please try again later.');
      }
    } finally {
      setIsChecking(false);
      setIsDownloading(false);
    }
  }, []);

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates(false);
  }, [checkForUpdates]);

  // Check for updates when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && !__DEV__ && Updates.isEnabled) {
        // Check for updates when app becomes active
        checkForUpdates(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkForUpdates]);

  return {
    isChecking,
    isDownloading,
    checkForUpdates,
  };
}
