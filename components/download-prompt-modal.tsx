import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface DownloadPromptModalProps {
  visible: boolean;
  title?: string;
  description?: string;
  warning?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DownloadPromptModal({
  visible,
  title = 'Download AI Model',
  description = 'This app requires a ~1 GB AI model for offline use. Download it now for the best experience.',
  warning = 'Without the model, chat and translation features won\'t work offline.',
  onConfirm,
  onCancel,
}: DownloadPromptModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <ThemedView style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
            <IconSymbol name="xmark" size={24} color={colors.icon} />
          </TouchableOpacity>

          <View style={[styles.iconContainer]}>
            <IconSymbol name="arrow.down.circle.fill" size={48} color={colors.tint} />
          </View>
          
          <ThemedText type="title" style={styles.modalTitle}>
            {title}
          </ThemedText>
          
          <ThemedText style={[styles.modalDescription, { color: colors.icon }]}>
            {description}
          </ThemedText>

          <TouchableOpacity
            style={[styles.downloadButton, { backgroundColor: colors.tint }]}
            onPress={onConfirm}>
            <IconSymbol name="arrow.down.circle" size={20} color="#fff" />
            <ThemedText style={styles.downloadButtonText}>Download Now</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={onCancel}>
            <ThemedText style={[styles.skipButtonText, { color: colors.icon }]}>
              Skip for now
            </ThemedText>
          </TouchableOpacity>

          <View style={[styles.warningBox, { backgroundColor: colors.tint + '08' }]}>
            <IconSymbol name="exclamationmark.triangle" size={18} color={colors.icon} />
            <ThemedText style={[styles.warningText, { color: colors.icon }]}>
              {warning}
            </ThemedText>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
  },
  modalDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  downloadButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    marginBottom: 24,
    padding: 8,
  },
  skipButtonText: {
    fontSize: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    padding: 16,
    borderRadius: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
