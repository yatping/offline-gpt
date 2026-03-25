import { ThemedText } from '@/components/themed-text';
import {
  debugIAP,
  getProducts,
  hasPurchasedPremiumLanguages,
  initializePurchases,
  purchasePremiumLanguages,
  restorePurchases,
} from '@/utils/purchase-manager';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

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
        
        // Regular price is $1.99, promotional price is $0.99 (until end of year)
        // For one-time purchases, the store API doesn't expose original price,
        // so we hardcode it and check if current price is lower
        const REGULAR_PRICE = '$4.99';
        if (product.price && product.price !== REGULAR_PRICE) {
          // Currently showing promotional price
          setOriginalPrice(REGULAR_PRICE);
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
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close Button */}
          <Pressable style={styles.closeIconButton} onPress={onClose}>
            <ThemedText style={styles.closeIcon}>✕</ThemedText>
          </Pressable>

          {/* Crown Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.crownIcon}>
              <View style={styles.crownTop}>
                <View style={styles.crownPeak} />
                <View style={[styles.crownPeak, styles.crownPeakMiddle]} />
                <View style={styles.crownPeak} />
              </View>
              <View style={styles.crownBase} />
            </View>
          </View>

          {/* Title */}
          <ThemedText style={styles.title}>Upgrade to Pro</ThemedText>
          
          {/* Subtitle */}
          <ThemedText style={styles.subtitle}>
            Unlock all languages and premium features
          </ThemedText>

          {/* Limited Offer Badge */}
          {originalPrice && price && originalPrice !== price && (
            <View style={styles.offerBadge}>
              <ThemedText style={styles.offerText}>🎉 LIMITED TIME OFFER</ThemedText>
              <View style={styles.priceComparisonRow}>
                <ThemedText style={styles.originalPrice}>{originalPrice}</ThemedText>
                <ThemedText style={styles.currentPriceSmall}>{price}</ThemedText>
              </View>
            </View>
          )}
          
          {/* Features List */}
          <View style={styles.features}>
            <View style={styles.featureRow}>
              <ThemedText style={styles.checkmark}>✓</ThemedText>
              <ThemedText style={styles.featureText}>30+ Premium Languages</ThemedText>
            </View>
            <View style={styles.featureRow}>
              <ThemedText style={styles.checkmark}>✓</ThemedText>
              <ThemedText style={styles.featureText}>One-Time Payment</ThemedText>
            </View>
            <View style={styles.featureRow}>
              <ThemedText style={styles.checkmark}>✓</ThemedText>
              <ThemedText style={styles.featureText}>No Subscriptions</ThemedText>
            </View>
            <View style={styles.featureRow}>
              <ThemedText style={styles.checkmark}>✓</ThemedText>
              <ThemedText style={styles.featureText}>Works Offline</ThemedText>
            </View>
          </View>

          {/* Purchase Button */}
          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} color="#D4A017" />
          ) : (
            <>
              <Pressable
                style={[styles.upgradeButton, (!price || isPurchased) && styles.upgradeButtonDisabled]}
                onPress={handlePurchase}
                disabled={isPurchased || !price}
              >
                <View style={styles.upgradeButtonIcon}>
                  <View style={styles.buttonCrownTop}>
                    <View style={styles.buttonCrownPeak} />
                    <View style={[styles.buttonCrownPeak, styles.buttonCrownPeakMiddle]} />
                    <View style={styles.buttonCrownPeak} />
                  </View>
                  <View style={styles.buttonCrownBase} />
                </View>
                <ThemedText style={styles.upgradeButtonText}>
                  {isPurchased 
                    ? 'Already Purchased' 
                    : price 
                      ? `Upgrade — ${price}${originalPrice && originalPrice !== price ? '' : '/one-time'}`
                      : 'Loading...'}
                </ThemedText>
              </Pressable>

              {/* Restore Purchase Button */}
              <Pressable style={styles.restoreButton} onPress={handleRestore}>
                <ThemedText style={styles.restoreButtonText}>
                  Restore Purchase
                </ThemedText>
              </Pressable>
            </>
          )}

          {/* Maybe Later */}
          <Pressable style={styles.maybeLaterButton} onPress={onClose}>
            <ThemedText style={styles.maybeLaterText}>Maybe later</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  closeIconButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 24,
    color: '#999',
    fontWeight: '300',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF9E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  crownIcon: {
    width: 36,
    height: 32,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  crownTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 36,
    marginBottom: -2,
  },
  crownPeak: {
    width: 8,
    height: 12,
    backgroundColor: '#D4A017',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  crownPeakMiddle: {
    height: 16,
  },
  crownBase: {
    width: 36,
    height: 14,
    backgroundColor: '#D4A017',
    borderRadius: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  offerBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  offerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F57C00',
    marginBottom: 8,
  },
  priceComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  originalPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    textDecorationLine: 'line-through',
  },
  currentPriceSmall: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F57C00',
  },
  features: {
    width: '100%',
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  checkmark: {
    fontSize: 18,
    color: '#D4A017',
    marginRight: 12,
    fontWeight: '700',
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    lineHeight: 22,
  },
  upgradeButton: {
    backgroundColor: '#D4A017',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#D4A017',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#CCC',
  },
  upgradeButtonIcon: {
    width: 18,
    height: 16,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginRight: 8,
  },
  buttonCrownTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 18,
    marginBottom: -1,
  },
  buttonCrownPeak: {
    width: 4,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  buttonCrownPeakMiddle: {
    height: 8,
  },
  buttonCrownBase: {
    width: 18,
    height: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  restoreButton: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  restoreButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  maybeLaterButton: {
    paddingVertical: 8,
  },
  maybeLaterText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  loader: {
    marginVertical: 20,
  },
});
