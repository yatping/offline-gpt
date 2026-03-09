import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AppMode } from '@/utils/app-mode-storage';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface FloatingModeButtonProps {
  currentMode: AppMode;
  onPress: () => void;
}

export function FloatingModeButton({ currentMode, onPress }: FloatingModeButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      style={[styles.floatingButton, { backgroundColor: colors.tint }]}
      onPress={onPress}
      activeOpacity={0.8}>
      <IconSymbol
        name={currentMode === 'chat' ? 'character.bubble.fill' : 'message.fill'}
        size={28}
        color="#fff"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
});
