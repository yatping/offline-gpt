import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Language } from '@/utils/language-preferences';
import { getProducts, hasPurchasedPremiumLanguages, initializePurchases } from '@/utils/purchase-manager';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  selectedLanguage: Language;
  languages: Language[];
  onSelect: (language: Language) => void;
  onClose: () => void;
  onShowPaywall: () => void;
};

export function LanguagePicker({
  visible,
  selectedLanguage,
  languages,
  onSelect,
  onClose,
  onShowPaywall,
}: Props) {
  const [hasPremium, setHasPremium] = useState(false);
  const [price, setPrice] = useState<string | null>(null);
  const [originalPrice, setOriginalPrice] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    const checkPremium = async () => {
      await initializePurchases();
      const purchased = await hasPurchasedPremiumLanguages();
      setHasPremium(purchased);
      
      // Load price
      if (!purchased) {
        const products = await getProducts();
        if (products.length > 0) {
          const product = products[0];
          setPrice(product.price || null);
          
          // Check for promotional pricing
          const productAny = product as any;
          if (productAny.introductoryPrice || productAny.subscriptionOffers) {
            if (productAny.price_string) {
              setOriginalPrice(productAny.price_string);
            } else if (productAny.originalPrice) {
              setOriginalPrice(productAny.originalPrice);
            }
          }
        }
      }
    };
    if (visible) {
      checkPremium();
    }
  }, [visible]);

  const handleLanguagePress = (language: Language) => {
    // Allow free languages or if user has premium
    if (language.isFree || hasPremium) {
      onSelect(language);
      onClose();
    } else {
      // Show paywall for premium languages
      onShowPaywall();
    }
  };

  const renderLanguageItem = ({ item }: { item: Language }) => {
    const isSelected = item.code === selectedLanguage.code;
    const isLocked = !item.isFree && !hasPremium;
    const isPremium = !item.isFree;

    return (
      <Pressable
        style={[
          styles.languageItem,
          isSelected && {
            backgroundColor: colors.tint + '20',
          },
        ]}
        onPress={() => handleLanguagePress(item)}
      >
        <View style={styles.languageContent}>
          <ThemedText
            style={[
              styles.languageName,
              isSelected && { fontWeight: '600', color: colors.tint },
            ]}
          >
            {item.name}
          </ThemedText>
          {isLocked && (
            <ThemedView style={styles.lockedBadge}>
              <ThemedText style={styles.lockedBadgeText}>PRO</ThemedText>
            </ThemedView>
          )}
        </View>
        {isSelected && <Ionicons name="checkmark" size={24} color={colors.tint} />}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Select Language</ThemedText>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.tint} />
          </Pressable>
        </ThemedView>

        {!hasPremium && (
          <Pressable style={styles.premiumBanner} onPress={onShowPaywall}>
            <Ionicons name="star" size={20} color="#FFD700" />
            {price ? (
              <ThemedText style={styles.premiumText}>
                {originalPrice && originalPrice !== price
                  ? `🎉 LIMITED OFFER: ${price} (was ${originalPrice})`
                  : `Unlock all languages for ${price}`}
              </ThemedText>
            ) : (
              <ActivityIndicator size="small" color="#B8860B" />
            )}
          </Pressable>
        )}

        <FlatList
          data={languages}
          renderItem={renderLanguageItem}
          keyExtractor={(item) => item.code}
          style={styles.list}
        />
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#FFF9E6',
    gap: 8,
  },
  premiumText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B8860B',
  },
  list: {
    flex: 1,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageName: {
    fontSize: 16,
  },
  lockIcon: {
    marginLeft: 4,
  },
  freeBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  freeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  proBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  lockedBadge: {
    backgroundColor: '#E5E5E5',
  },
  lockedBadgeText: {
    color: '#999',
  },
});
