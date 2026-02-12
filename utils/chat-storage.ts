import { ChatMessage } from '@/hooks/use-chat-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
};

// Storage keys
const STORAGE_KEYS = {
  CHAT_SESSIONS: '@chat/sessions',
  ACTIVE_SESSION_ID: '@chat/active_session_id',
};

// Generate a unique ID for a session
export const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

// Generate a title from the first user message
export const generateSessionTitle = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (firstUserMessage) {
    const preview = firstUserMessage.content.substring(0, 50);
    return preview.length < firstUserMessage.content.length ? `${preview}...` : preview;
  }
  return 'New Chat';
};

// Save all sessions
export const saveSessions = async (sessions: ChatSession[]): Promise<void> => {
  try {
    const serializedSessions = sessions.map((session) => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }));
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_SESSIONS, JSON.stringify(serializedSessions));
  } catch (error) {
    console.error('Failed to save chat sessions:', error);
    throw error;
  }
};

// Load all sessions
export const loadSessions = async (): Promise<ChatSession[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_SESSIONS);
    if (!data) return [];
    
    const parsedSessions = JSON.parse(data);
    return parsedSessions.map((session: any) => ({
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    }));
  } catch (error) {
    console.error('Failed to load chat sessions:', error);
    return [];
  }
};

// Save a single session (creates or updates)
export const saveSession = async (session: ChatSession): Promise<void> => {
  try {
    const sessions = await loadSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    
    if (existingIndex !== -1) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    
    // Sort by updatedAt (most recent first)
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    await saveSessions(sessions);
  } catch (error) {
    console.error('Failed to save session:', error);
    throw error;
  }
};

// Delete a session
export const deleteSession = async (sessionId: string): Promise<void> => {
  try {
    const sessions = await loadSessions();
    const filteredSessions = sessions.filter((s) => s.id !== sessionId);
    await saveSessions(filteredSessions);
    
    // If we deleted the active session, clear the active session ID
    const activeSessionId = await getActiveSessionId();
    if (activeSessionId === sessionId) {
      await setActiveSessionId(null);
    }
  } catch (error) {
    console.error('Failed to delete session:', error);
    throw error;
  }
};

// Get a specific session by ID
export const getSession = async (sessionId: string): Promise<ChatSession | null> => {
  try {
    const sessions = await loadSessions();
    return sessions.find((s) => s.id === sessionId) || null;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
};

// Save the active session ID
export const setActiveSessionId = async (sessionId: string | null): Promise<void> => {
  try {
    if (sessionId) {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, sessionId);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
    }
  } catch (error) {
    console.error('Failed to set active session ID:', error);
    throw error;
  }
};

// Get the active session ID
export const getActiveSessionId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
  } catch (error) {
    console.error('Failed to get active session ID:', error);
    return null;
  }
};

// Clear all sessions (useful for testing or reset)
export const clearAllSessions = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.CHAT_SESSIONS);
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
  } catch (error) {
    console.error('Failed to clear all sessions:', error);
    throw error;
  }
};
