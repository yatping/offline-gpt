import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { ChatMessage, useChatAI } from '@/hooks/use-chat-ai';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ChatSession,
  deleteSession as deleteSessionFromStorage,
  generateSessionId,
  generateSessionTitle,
  getActiveSessionId,
  loadSessions,
  saveSession,
  setActiveSessionId,
} from '@/utils/chat-storage';

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const {
    status,
    error,
    progress,
    initializeModel,
    generateResponse,
    releaseModel,
    isReady,
    isGenerating,
  } = useChatAI();
  
  const [showSidebar, setShowSidebar] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasInitializedRef = useRef(false);
  
  // Initialize model when screen is focused, release when unfocused
  useFocusEffect(
    useCallback(() => {
      if (!hasInitializedRef.current && status === 'idle') {
        console.log('Chat screen focused - checking for model');
        hasInitializedRef.current = true;
        initializeModel();
      }

      return () => {
        console.log('Chat screen unfocused - releasing model');
        hasInitializedRef.current = false;
        releaseModel();
      };
    }, [])
  );

  // Load sessions from storage on mount
  useEffect(() => {
    const loadInitialSessions = async () => {
      try {
        setIsLoadingSessions(true);
        const storedSessions = await loadSessions();
        console.log('Loaded sessions:', storedSessions.length, storedSessions.map(s => ({
          id: s.id,
          title: s.title,
          messageCount: s.messages?.length || 0,
        })));
        const activeId = await getActiveSessionId();
        console.log('Active session ID:', activeId);
        
        if (storedSessions.length > 0) {
          setSessions(storedSessions);
          // Use the active session if it exists, otherwise use the first session
          const validActiveId = storedSessions.find(s => s.id === activeId)
            ? activeId
            : storedSessions[0].id;
          setCurrentSessionId(validActiveId);
        } else {
          // Create a default session if none exist
          const newSession: ChatSession = {
            id: generateSessionId(),
            title: 'New Chat',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setSessions([newSession]);
          setCurrentSessionId(newSession.id);
          await saveSession(newSession);
          await setActiveSessionId(newSession.id);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
        // Fallback to a new session
        const fallbackSession: ChatSession = {
          id: generateSessionId(),
          title: 'New Chat',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setSessions([fallbackSession]);
        setCurrentSessionId(fallbackSession.id);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadInitialSessions();
  }, []);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Save active session ID when it changes
  useEffect(() => {
    if (currentSessionId) {
      setActiveSessionId(currentSessionId);
    }
  }, [currentSessionId]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentSession || !isReady) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputText,
    };
    
    setInputText('');

    // Create updated session with user message
    const updatedSession: ChatSession = {
      ...currentSession,
      messages: [...currentSession.messages, userMessage],
      updatedAt: new Date(),
      title: currentSession.messages.length === 0 ? generateSessionTitle([userMessage]) : currentSession.title,
    };

    // Update state
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId ? updatedSession : session
    ));

    // Save the updated session
    console.log('Saving session with user message:', {
      id: updatedSession.id,
      title: updatedSession.title,
      messageCount: updatedSession.messages.length,
    });
    await saveSession(updatedSession);

    // Scroll to bottom after user message
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Prepare messages for AI
      const aiMessages = updatedSession.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add a placeholder assistant message that will be updated with streaming response
      const assistantPlaceholder: ChatMessage = {
        role: 'assistant',
        content: '',
      };
      // Index is after all existing messages in the updated session
      const assistantMessageIndex = updatedSession.messages.length;
      
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, assistantPlaceholder],
          };
        }
        return session;
      }));

      // Generate AI response with streaming
      const response = await generateResponse(
        aiMessages,
        (partial) => {
          // Update the assistant message with partial response
          setSessions(prev => prev.map(session => {
            if (session.id === currentSessionId) {
              const newMessages = [...session.messages];
              newMessages[assistantMessageIndex] = {
                role: 'assistant',
                content: partial,
              };
              return {
                ...session,
                messages: newMessages,
              };
            }
            return session;
          }));
          
          // Auto-scroll as response streams in
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 50);
        }
      );

      // Create the final session with complete response
      const finalMessages = [...updatedSession.messages, {
        role: 'assistant' as const,
        content: response,
      }];
      
      const finalSession: ChatSession = {
        ...updatedSession,
        messages: finalMessages,
        updatedAt: new Date(),
      };
      
      // Update state
      setSessions(prev => prev.map(session => 
        session.id === currentSessionId ? finalSession : session
      ));
      
      // Save the final session with complete response
      console.log('Saving session with AI response:', {
        id: finalSession.id,
        title: finalSession.title,
        messageCount: finalSession.messages.length,
        lastMessage: finalSession.messages[finalSession.messages.length - 1]?.content?.substring(0, 50),
      });
      await saveSession(finalSession);
      
      // Scroll to bottom after complete response
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error('Chat error:', err);
      
      // Create error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error generating a response. Please try again.',
      };
      
      // Create session with error message (using the updated session with user message)
      const errorSession: ChatSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, errorMessage],
        updatedAt: new Date(),
      };
      
      // Update state
      setSessions(prev => prev.map(session => 
        session.id === currentSessionId ? errorSession : session
      ));
      
      // Save session with error message
      await saveSession(errorSession);
    }
  };

  const createNewChat = async () => {
    const newSession: ChatSession = {
      id: generateSessionId(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setShowSidebar(false);
    
    // Save the new session and set it as active
    await saveSession(newSession);
    await setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      // Delete from storage
      await deleteSessionFromStorage(sessionId);
      
      // Update local state
      const filtered = sessions.filter(s => s.id !== sessionId);
      setSessions(filtered);
      
      // If we deleted the current session, switch to another or create new
      if (currentSessionId === sessionId) {
        if (filtered.length > 0) {
          setCurrentSessionId(filtered[0].id);
          await setActiveSessionId(filtered[0].id);
        } else {
          // No sessions left, create a new one
          const newSession: ChatSession = {
            id: generateSessionId(),
            title: 'New Chat',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setSessions([newSession]);
          setCurrentSessionId(newSession.id);
          await saveSession(newSession);
          await setActiveSessionId(newSession.id);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };



  // Show loading screen while model is initializing
  if (status === 'loading' || status === 'downloading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ThemedView style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>
            {status === 'downloading' 
              ? `Downloading Chat AI Model... ${progress}%` 
              : 'Loading Chat AI Model...'}
          </ThemedText>
          {status === 'downloading' && (
            <View style={[styles.progressBar, { backgroundColor: colors.icon + '20' }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: colors.tint,
                    width: `${progress}%`
                  }
                ]} 
              />
            </View>
          )}
          <ThemedText style={[styles.loadingSubtext, { color: colors.icon }]}>
            {status === 'downloading'
              ? "This may take a few minutes. Please don't close the app."
              : 'This may take a few seconds'}
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ThemedView style={[styles.container, styles.centerContent]}>
          <IconSymbol name="exclamationmark.triangle" size={64} color="#ff4444" />
          <ThemedText style={[styles.errorText, { color: '#ff4444' }]}>
            Failed to load Chat AI
          </ThemedText>
          {error && (
            <ThemedText style={[styles.errorSubtext, { color: colors.icon }]}>
              {error}
            </ThemedText>
          )}
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
            onPress={initializeModel}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }
  
  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: colors.background }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowSidebar(!showSidebar)}>
            <IconSymbol name="line.3.horizontal" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <ThemedText style={styles.headerTitle}>
              {currentSession?.title || 'Chat'}
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.newChatButton} onPress={createNewChat}>
            <IconSymbol name="square.and.pencil" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView 
        style={[styles.content, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={styles.chatArea}>
            <ScrollView 
              ref={scrollViewRef}
              style={styles.messagesContainer} 
              contentContainerStyle={styles.messagesContent}>
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
                currentSession?.messages.filter(msg => msg.content && msg.content.trim()).map((message, index) => (
                  <View
                    key={`${currentSessionId}-${index}`}
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
                    backgroundColor: colorScheme === 'dark' ? '#1f2022' : colors.icon + '10',
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
                  { backgroundColor: inputText.trim() && isReady && !isGenerating ? colors.tint : colors.icon + '40' },
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || !isReady || isGenerating}>
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <IconSymbol name="arrow.up" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

      {/* Sidebar - positioned to cover entire screen including bottom bar and notch */}
      {showSidebar && (
        <>
          <Pressable
            style={styles.overlay}
            onPress={() => setShowSidebar(false)}
          />
          <SafeAreaView style={[styles.sidebar, { backgroundColor: colors.background, borderRightColor: colors.icon + '30' }]} edges={['top', 'bottom']}>
            <View style={styles.sidebarHeader}>
              <ThemedText style={styles.sidebarTitle}>Chat History</ThemedText>
              <TouchableOpacity onPress={createNewChat}>
                <IconSymbol name="plus.circle.fill" size={28} color={colors.tint} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sessionList}>
              {sessions.map((session) => {
                const lastMessage = session.messages.length > 0 
                  ? session.messages[session.messages.length - 1].content 
                  : 'No messages yet';
                  
                return (
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
                        {lastMessage}
                      </ThemedText>
                      <ThemedText style={[styles.sessionTimestamp, { color: colors.icon }]}>
                        {session.updatedAt.toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteSession(session.id)}>
                      <IconSymbol name="trash" size={18} color={colors.icon} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  progressBar: {
    width: '80%',
    height: 8,
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  newChatButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 4,
  },
  sessionTimestamp: {
    fontSize: 12,
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
