import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Language, LANGUAGES } from '@/utils/language-preferences';
import { hasPurchasedPremiumLanguages } from '@/utils/purchase-manager';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  selectedLanguage: Language;
  onSelect: (language: Language) => void;
  onClose: () => void;
  onShowPaywall: () => void;
};

export function LanguagePicker({
  visible,
  selectedLanguage,
  onSelect,
  onClose,
  onShowPaywall,
}: Props) {
  const [hasPremium, setHasPremium] = useState(false);

  useEffect(() => {
    const checkPremium = async () => {
      const purchased = await hasPurchasedPremiumLanguages();
      setHasPremium(purchased);
    };
    if (visible) {
      checkPremium();
    }
  }, [visible]);

  const handleLanguagePress = (language: Language & { isFree?: boolean }) => {
    // Allow free languages or if user has premium
    if (language.isFree || hasPremium) {
      onSelect(language);
      onClose();
    } else {
      // Show paywall for premium languages
      onShowPaywall();
    }
  };

  const renderLanguageItem = ({ item }: { item: Language & { isFree?: boolean } }) => {
    const isSelected = item.code === selectedLanguage.code;
    const isLocked = !item.isFree && !hasPremium;

    return (
      <Pressable
        style={[styles.languageItem, isSelected && styles.selectedItem]}
        onPress={() => handleLanguagePress(item)}
      >
        <ThemedView style={styles.languageContent}>
          <ThemedText style={[styles.languageName, isSelected && styles.selectedText]}>
            {item.name}
          </ThemedText>
          {isLocked && (
            <Ionicons name="lock-closed" size={18} color="#999" style={styles.lockIcon} />
          )}
          {item.isFree && (
            <ThemedView style={styles.freeBadge}>
              <ThemedText style={styles.freeBadgeText}>FREE</ThemedText>
            </ThemedView>
          )}
        </ThemedView>
        {isSelected && <Ionicons name="checkmark" size={24} color="#007AFF" />}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.title}>Select Language</ThemedText>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#007AFF" />
          </Pressable>
        </ThemedView>

        {!hasPremium && (
          <ThemedView style={styles.premiumBanner}>
            <Ionicons name="star" size={20} color="#FFD700" />
            <ThemedText style={styles.premiumText}>
              Unlock all languages for $0.99
            </ThemedText>
          </ThemedView>
        )}

        <FlatList
          data={LANGUAGES}
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
  selectedItem: {
    backgroundColor: '#F0F8FF',
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageName: {
    fontSize: 16,
  },
  selectedText: {
    fontWeight: '600',
    color: '#007AFF',
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
});
