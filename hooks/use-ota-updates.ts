import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

export function useOTAUpdates() {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const checkForUpdates = useCallback(async (showAlerts = false) => {
    // Skip in development builds - OTA updates are not supported
    if (__DEV__) {
      return;
    }

    // Check if updates are properly configured
    if (!Updates.isEnabled) {
      return;
    }

    // Validate runtime version exists
    if (!Updates.runtimeVersion) {
      return;
    }

    try {
      setIsChecking(true);
      
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        setIsDownloading(true);
        
        // Fetch the update
        const fetchResult = await Updates.fetchUpdateAsync();
        
        if (fetchResult.isNew) {
          // Show alert to user
          Alert.alert(
            'Update Ready',
            'A new version has been downloaded. Restart the app to apply the update?',
            [
              {
                text: 'Later',
                style: 'cancel',
              },
              {
                text: 'Restart Now',
                onPress: async () => {
                  await Updates.reloadAsync();
                },
              },
            ],
            { cancelable: false }
          );
        }
      } else {
        if (showAlerts) {
          Alert.alert('Up to Date', 'You are running the latest version');
        }
      }
    } catch (error) {
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
