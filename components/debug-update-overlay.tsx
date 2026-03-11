import { manualUpdateCheck } from '@/utils/ota-updates';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function DebugUpdateOverlay() {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const checkUpdate = async () => {
    addLog('Starting manual update check...');
    try {
      await manualUpdateCheck();
      addLog('Update check completed');
    } catch (error) {
      addLog(`Error: ${error}`);
    }
  };

  const updateInfo = {
    updateId: Updates.updateId || 'None',
    channel: Updates.channel || 'None',
    runtimeVersion: Updates.runtimeVersion || 'None',
    isEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    createdAt: Updates.createdAt ? new Date(Updates.createdAt).toLocaleString() : 'N/A',
  };

  return (
    <>
      {/* Floating debug button - triple tap to show */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>🔧</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>OTA Update Debug</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Update Info</Text>
                <Text style={styles.infoText}>Update ID: {updateInfo.updateId}</Text>
                <Text style={styles.infoText}>Channel: {updateInfo.channel}</Text>
                <Text style={styles.infoText}>Runtime: {updateInfo.runtimeVersion}</Text>
                <Text style={styles.infoText}>Enabled: {updateInfo.isEnabled ? '✅' : '❌'}</Text>
                <Text style={styles.infoText}>
                  Launch: {updateInfo.isEmbeddedLaunch ? 'Embedded' : 'OTA'}
                </Text>
                <Text style={styles.infoText}>Created: {updateInfo.createdAt}</Text>
              </View>

              <TouchableOpacity style={styles.checkButton} onPress={checkUpdate}>
                <Text style={styles.checkButtonText}>Check for Updates</Text>
              </TouchableOpacity>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Logs</Text>
                {logs.length === 0 ? (
                  <Text style={styles.infoText}>No logs yet</Text>
                ) : (
                  logs.map((log, index) => (
                    <Text key={index} style={styles.logText}>
                      {log}
                    </Text>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 999,
  },
  buttonText: {
    fontSize: 24,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
    fontFamily: 'monospace',
  },
  checkButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logText: {
    fontSize: 12,
    marginBottom: 3,
    color: '#444',
    fontFamily: 'monospace',
  },
});
