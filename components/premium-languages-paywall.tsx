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
  const [price, setPrice] = useState<string | null>(null);
  const [originalPrice, setOriginalPrice] = useState<string | null>(null);
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
        const product = products[0];
        setPrice(product.price || null);
        
        // Check for introductory/promotional pricing
        // On iOS: product.introductoryPrice, on Android: introductoryPriceAmountMicros
        const productAny = product as any;
        if (productAny.introductoryPrice || productAny.subscriptionOffers) {
          // Has promotional pricing - the price field is the promo price
          // Try to get the original price
          if (productAny.price_string) {
            setOriginalPrice(productAny.price_string);
          } else if (productAny.originalPrice) {
            setOriginalPrice(productAny.originalPrice);
          }
        }
      } else {
        console.error('❌ No products loaded in paywall');
        setPrice(null);
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
            Multiple languages are free forever!
          </ThemedText>
          
          <ThemedView style={styles.pricingContainer}>
            {originalPrice && price && originalPrice !== price && (
              <ThemedText style={styles.offerBadge}>🎉 LIMITED TIME OFFER</ThemedText>
            )}
            {price ? (
              <ThemedView style={styles.priceDisplay}>
                {originalPrice && originalPrice !== price && (
                  <ThemedText style={styles.originalPrice}>{originalPrice}</ThemedText>
                )}
                <ThemedText style={styles.currentPrice}>{price}</ThemedText>
                {originalPrice && originalPrice !== price && (
                  <ThemedView style={styles.discountBadge}>
                    <ThemedText style={styles.discountText}>SAVE</ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            ) : (
              <ActivityIndicator size="small" style={styles.priceLoader} />
            )}
            <ThemedText style={styles.oneTimeText}>One-time purchase • No subscription</ThemedText>
          </ThemedView>

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
                style={[styles.purchaseButton, (!price || isPurchased) && styles.purchaseButtonDisabled]}
                onPress={handlePurchase}
                disabled={isPurchased || !price}
              >
                <ThemedText style={styles.purchaseButtonText}>
                  {isPurchased ? 'Already Purchased' : price ? `Unlock for ${price}` : 'Loading...'}
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
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  pricingContainer: {
    marginBottom: 8,
    alignItems: 'center',
    width: '100%',
  },
  offerBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 8,
    textAlign: 'center',
  },
  priceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 24,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  currentPrice: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#34C759',
  },
  discountBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  oneTimeText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 4,
  },
  priceLoader: {
    marginVertical: 20,
  },
  purchaseButtonDisabled: {
    opacity: 0.5,
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
