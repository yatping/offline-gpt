import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  debugIAP,
  getProducts,
  hasPurchasedPremiumLanguages,
  initializePurchases,
  purchasePremiumLanguages,
  restorePurchases,
} from '@/utils/purchase-manager';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPurchaseComplete: () => void;
};

export function PremiumLanguagesPaywall({ visible, onClose, onPurchaseComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState('$0.99');
  const [isPurchased, setIsPurchased] = useState(false);

  useEffect(() => {
    const setup = async () => {
      await initializePurchases();
      // Debug IAP
      console.log('🔍 Running IAP Debug...');
      await debugIAP();
      
      // Check if already purchased
      const purchased = await hasPurchasedPremiumLanguages();
      setIsPurchased(purchased);
      
      // Load product price
      const products = await getProducts();
      if (products.length > 0) {
        setPrice(products[0].price || '$0.99');
      } else {
        console.error('❌ No products loaded in paywall');
        // Keep default price if no products found
        setPrice('$0.99');
      }
    };
    
    if (visible) {
      setup();
    }
  }, [visible]);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const result = await purchasePremiumLanguages();
      if (result.success) {
        Alert.alert(
          'Success!',
          'You now have access to all premium languages!',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsPurchased(true);
                onPurchaseComplete();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Purchase Failed', 
          result.error || 'Please try again later.\n\nCheck the console logs for more details.'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert(
          'Restored!',
          'Your purchase has been restored.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsPurchased(true);
                onPurchaseComplete();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases to restore.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.overlay}>
        <ThemedView style={styles.container}>
          <ThemedText style={styles.title}>Unlock Premium Languages</ThemedText>
          
          <ThemedText style={styles.description}>
            English and Spanish are free forever!
          </ThemedText>
          
          <ThemedText style={styles.description}>
            Unlock all other languages for just {price}
          </ThemedText>

          <ThemedView style={styles.features}>
            <ThemedText style={styles.feature}>✓ 30+ Premium Languages</ThemedText>
            <ThemedText style={styles.feature}>✓ One-Time Payment</ThemedText>
            <ThemedText style={styles.feature}>✓ No Subscriptions</ThemedText>
            <ThemedText style={styles.feature}>✓ Works Offline</ThemedText>
          </ThemedView>

          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : (
            <>
              <Pressable
                style={styles.purchaseButton}
                onPress={handlePurchase}
                disabled={isPurchased}
              >
                <ThemedText style={styles.purchaseButtonText}>
                  {isPurchased ? 'Already Purchased' : `Unlock for ${price}`}
                </ThemedText>
              </Pressable>

              <Pressable style={styles.restoreButton} onPress={handleRestore}>
                <ThemedText style={styles.restoreButtonText}>
                  Restore Purchase
                </ThemedText>
              </Pressable>
            </>
          )}

          <Pressable style={styles.closeButton} onPress={onClose}>
            <ThemedText style={styles.closeButtonText}>Maybe Later</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
  features: {
    marginTop: 24,
    marginBottom: 24,
    width: '100%',
  },
  feature: {
    fontSize: 16,
    marginBottom: 8,
    paddingLeft: 8,
  },
  purchaseButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  restoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  restoreButtonText: {
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  closeButtonText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
  },
  loader: {
    marginVertical: 20,
  },
});
