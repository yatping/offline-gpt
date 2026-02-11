import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ChatMessage = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
};

type ChatSession = {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: ChatMessage[];
};

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [showSidebar, setShowSidebar] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: '1',
      title: 'Translation Help',
      lastMessage: 'How do I say hello in Spanish?',
      timestamp: new Date(Date.now() - 3600000),
      messages: [
        {
          id: '1',
          content: 'How do I say hello in Spanish?',
          role: 'user',
          timestamp: new Date(Date.now() - 3600000),
        },
        {
          id: '2',
          content: 'In Spanish, you can say "Hola" for hello.',
          role: 'assistant',
          timestamp: new Date(Date.now() - 3590000),
        },
      ],
    },
  ]);
  const [currentSessionId, setCurrentSessionId] = useState('1');

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const handleSend = () => {
    if (!inputText.trim() || !currentSession) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputText,
      role: 'user',
      timestamp: new Date(),
    };

    const updatedSessions = sessions.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          messages: [...session.messages, newMessage],
          lastMessage: inputText,
          timestamp: new Date(),
        };
      }
      return session;
    });

    setSessions(updatedSessions);
    setInputText('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: 'This is a placeholder response. In a real app, this would be connected to an AI service.',
        role: 'assistant',
        timestamp: new Date(),
      };

      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, aiResponse],
            lastMessage: aiResponse.content,
            timestamp: new Date(),
          };
        }
        return session;
      }));
    }, 1000);
  };

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      lastMessage: '',
      timestamp: new Date(),
      messages: [],
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setShowSidebar(false);
  };

  const deleteSession = (sessionId: string) => {
    const filtered = sessions.filter(s => s.id !== sessionId);
    setSessions(filtered);
    if (currentSessionId === sessionId && filtered.length > 0) {
      setCurrentSessionId(filtered[0].id);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowSidebar(!showSidebar)}>
          <IconSymbol name="line.3.horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>
          {currentSession?.title || 'Chat'}
        </ThemedText>
        <TouchableOpacity style={styles.newChatButton} onPress={createNewChat}>
          <IconSymbol name="square.and.pencil" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Sidebar */}
        {showSidebar && (
          <>
            <Pressable
              style={styles.overlay}
              onPress={() => setShowSidebar(false)}
            />
            <View style={[styles.sidebar, { backgroundColor: colors.background, borderRightColor: colors.icon + '30' }]}>
              <View style={styles.sidebarHeader}>
                <ThemedText style={styles.sidebarTitle}>Chat History</ThemedText>
                <TouchableOpacity onPress={createNewChat}>
                  <IconSymbol name="plus.circle.fill" size={28} color={colors.tint} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.sessionList}>
                {sessions.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={[
                      styles.sessionItem,
                      { 
                        backgroundColor: session.id === currentSessionId ? colors.tint + '20' : 'transparent',
                        borderBottomColor: colors.icon + '20',
                      },
                    ]}
                    onPress={() => {
                      setCurrentSessionId(session.id);
                      setShowSidebar(false);
                    }}>
                    <View style={styles.sessionInfo}>
                      <ThemedText style={styles.sessionTitle} numberOfLines={1}>
                        {session.title}
                      </ThemedText>
                      <ThemedText style={[styles.sessionPreview, { color: colors.icon }]} numberOfLines={1}>
                        {session.lastMessage || 'No messages yet'}
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteSession(session.id)}>
                      <IconSymbol name="trash" size={18} color={colors.icon} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {/* Main Chat Area */}
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={90}>
          <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
            {currentSession?.messages.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol name="message" size={64} color={colors.icon + '40'} />
                <ThemedText style={[styles.emptyText, { color: colors.icon }]}>
                  Start a conversation
                </ThemedText>
                <ThemedText style={[styles.emptySubtext, { color: colors.icon }]}>
                  Type a message below to begin
                </ThemedText>
              </View>
            ) : (
              currentSession?.messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageWrapper,
                    message.role === 'user' ? styles.userMessageWrapper : styles.assistantMessageWrapper,
                  ]}>
                  <ThemedView
                    style={[
                      styles.messageBubble,
                      message.role === 'user'
                        ? { backgroundColor: colors.tint }
                        : { backgroundColor: colors.icon + '20' },
                    ]}>
                    <ThemedText
                      style={[
                        styles.messageText,
                        message.role === 'user' && { color: '#fff' },
                      ]}>
                      {message.content}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.messageTime,
                        { color: message.role === 'user' ? '#fff' : colors.icon },
                        message.role === 'user' && { opacity: 0.8 },
                      ]}>
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </ThemedText>
                  </ThemedView>
                </View>
              ))
            )}
          </ScrollView>

          <View style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: colors.icon + '30' }]}>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.icon + '10',
                },
              ]}
              placeholder="Type a message..."
              placeholderTextColor={colors.icon}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: inputText.trim() ? colors.tint : colors.icon + '40' },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim()}>
              <IconSymbol name="arrow.up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  newChatButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '75%',
    maxWidth: 300,
    borderRightWidth: 1,
    zIndex: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sessionList: {
    flex: 1,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionPreview: {
    fontSize: 14,
  },
  deleteButton: {
    padding: 8,
  },
  chatArea: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  messageWrapper: {
    marginBottom: 12,
  },
  userMessageWrapper: {
    alignItems: 'flex-end',
  },
  assistantMessageWrapper: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

