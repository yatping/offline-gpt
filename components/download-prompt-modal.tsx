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
  onConfirm: () => void;
  onCancel: () => void;
}

export function DownloadPromptModal({
  visible,
  title = 'Download AI Model',
  description = 'To use offline features, we need to download the AI model to your device.',
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
          <IconSymbol name="arrow.down.circle.fill" size={48} color={colors.tint} />
          
          <ThemedText type="title" style={styles.modalTitle}>
            {title}
          </ThemedText>
          
          <ThemedText style={[styles.modalDescription, { color: colors.icon }]}>
            {description}
          </ThemedText>
          
          <View style={[styles.infoBox, { backgroundColor: colors.tint + '10' }]}>
            <View style={styles.infoRow}>
              <IconSymbol name="arrow.down.to.line" size={20} color={colors.tint} />
              <ThemedText style={styles.infoText}>Download Size: ~50-100 MB</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <IconSymbol name="wifi" size={20} color={colors.tint} />
              <ThemedText style={styles.infoText}>WiFi recommended</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <IconSymbol name="clock" size={20} color={colors.tint} />
              <ThemedText style={styles.infoText}>Takes 2-5 minutes</ThemedText>
            </View>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { borderColor: colors.icon + '30' }]}
              onPress={onCancel}>
              <ThemedText style={{ color: colors.text }}>Not Now</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.tint }]}
              onPress={onConfirm}>
              <ThemedText style={styles.confirmButtonText}>Download</ThemedText>
            </TouchableOpacity>
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
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  infoBox: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
