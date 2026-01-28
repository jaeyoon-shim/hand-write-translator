import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SessionData {
  sessionId: string;
  token: string;
  expiresAt: number;
}

const SESSION_STORAGE_KEY = 'app_session_data';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer

export function useSessionToken() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(false);
  const sessionDataRef = useRef<SessionData | null>(null);

  // Load existing session from storage
  const loadStoredSession = useCallback((): SessionData | null => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const data: SessionData = JSON.parse(stored);
        // Check if session is still valid (with buffer)
        if (data.expiresAt > Date.now() + EXPIRY_BUFFER_MS) {
          return data;
        }
        // Session expired, clear it
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Invalid stored data, clear it
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    return null;
  }, []);

  // Create new session
  const createSession = useCallback(async (): Promise<SessionData | null> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-session', {
        method: 'POST',
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.success && data.token && data.sessionId) {
        const sessionData: SessionData = {
          sessionId: data.sessionId,
          token: data.token,
          expiresAt: Date.now() + (data.expiresIn * 1000),
        };

        // Store in session storage
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
        sessionDataRef.current = sessionData;
        
        return sessionData;
      }

      throw new Error('Invalid session response');
    } catch (err) {
      console.error('Failed to create session:', err);
      throw err;
    }
  }, []);

  // Initialize session
  const initializeSession = useCallback(async () => {
    // Prevent duplicate initialization
    if (initializingRef.current) return;
    initializingRef.current = true;

    setIsLoading(true);
    setError(null);

    try {
      // Try to load existing session
      let session = loadStoredSession();
      
      // If no valid session, create new one
      if (!session) {
        session = await createSession();
      }

      if (session) {
        setSessionToken(session.token);
        setSessionId(session.sessionId);
        sessionDataRef.current = session;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize session';
      setError(message);
      console.error('Session initialization error:', message);
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, [loadStoredSession, createSession]);

  // Check if current session is valid and refresh if needed
  const ensureValidSession = useCallback(async (): Promise<string | null> => {
    const currentSession = sessionDataRef.current;
    
    // Check if session exists and is still valid
    if (currentSession && currentSession.expiresAt > Date.now() + EXPIRY_BUFFER_MS) {
      return currentSession.token;
    }

    // Session expired or doesn't exist, create new one
    console.log('Session expired or missing, creating new session...');
    
    // Clear old session
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionToken(null);
    setSessionId(null);
    sessionDataRef.current = null;
    
    try {
      initializingRef.current = false;
      const newSession = await createSession();
      if (newSession) {
        setSessionToken(newSession.token);
        setSessionId(newSession.sessionId);
        sessionDataRef.current = newSession;
        return newSession.token;
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
    }
    
    return null;
  }, [createSession]);

  // Refresh session (for when token expires or on 401)
  const refreshSession = useCallback(async () => {
    // Clear stored session
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionToken(null);
    setSessionId(null);
    sessionDataRef.current = null;
    
    // Create new session
    initializingRef.current = false;
    await initializeSession();
  }, [initializeSession]);

  // Initialize on mount
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  return {
    sessionToken,
    sessionId,
    isLoading,
    error,
    refreshSession,
    ensureValidSession,
  };
}
