'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface Citation {
  filePath?: string;
  symbolFqn?: string;
  startLine?: number;
  endLine?: number;
  label?: string;
}

export interface ChatMessageItem {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[] | null;
  intent?: string | null;
  modelUsed?: string | null;
  latencyMs?: number | null;
  createdAt: string;
}

export interface ChatSessionItem {
  id: string;
  repositoryId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessageItem[];
}

export function useChat(repositoryId: string) {
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Fetch sessions for this repository
  const {
    data: sessions = [],
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useQuery<ChatSessionItem[]>({
    queryKey: ['chat-sessions', repositoryId],
    queryFn: async () => {
      const res = await apiClient.get(`/repositories/${repositoryId}/chat/sessions`);
      return res.data;
    },
    enabled: !!repositoryId,
  });

  // Auto-select first session if none selected
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // 2. Fetch active session messages
  const {
    data: activeSession,
    isLoading: messagesLoading,
    refetch: refetchActiveSession,
  } = useQuery<ChatSessionItem>({
    queryKey: ['chat-session', repositoryId, activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return null;
      const res = await apiClient.get(
        `/repositories/${repositoryId}/chat/sessions/${activeSessionId}`,
      );
      return res.data;
    },
    enabled: !!repositoryId && !!activeSessionId,
  });

  // 3. Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (title?: string) => {
      const res = await apiClient.post(
        `/repositories/${repositoryId}/chat/sessions`,
        { title: title || 'New Chat' },
      );
      return res.data;
    },
    onSuccess: (newSession: ChatSessionItem) => {
      queryClient.setQueryData(
        ['chat-sessions', repositoryId],
        (old: ChatSessionItem[] = []) => [newSession, ...old],
      );
      setActiveSessionId(newSession.id);
    },
  });

  // 4. Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.delete(
        `/repositories/${repositoryId}/chat/sessions/${sessionId}`,
      );
      return sessionId;
    },
    onSuccess: (deletedId: string) => {
      queryClient.setQueryData(
        ['chat-sessions', repositoryId],
        (old: ChatSessionItem[] = []) => old.filter((s) => s.id !== deletedId),
      );
      if (activeSessionId === deletedId) {
        const remaining = sessions.filter((s) => s.id !== deletedId);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    },
  });

  // 5. Send message with SSE streaming
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      let currentSessionId = activeSessionId;

      // Auto-create session if none active
      if (!currentSessionId) {
        const newSession = await createSessionMutation.mutateAsync('New Chat');
        currentSessionId = newSession.id;
        setActiveSessionId(newSession.id);
      }

      setIsStreaming(true);
      setStreamingContent('');

      // Optimistically add user message to current view
      const tempUserMsg: ChatMessageItem = {
        id: `temp-${Date.now()}`,
        sessionId: currentSessionId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData(
        ['chat-session', repositoryId, currentSessionId],
        (old: ChatSessionItem | null) => {
          if (!old) return old;
          return {
            ...old,
            messages: [...(old.messages || []), tempUserMsg],
          };
        },
      );

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('prbot_app_key') : null;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['X-App-Key'] = token;
        }

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        const response = await fetch(
          `${baseUrl}/repositories/${repositoryId}/chat/sessions/${currentSessionId}/messages`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ content }),
            credentials: 'include',
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Chat error: HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No readable response stream');
        }

        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.token) {
                  accumulated += parsed.token;
                  setStreamingContent(accumulated);
                }
                if (parsed.done) {
                  // Message generation finished
                  if (parsed.message) {
                    const finalAssistantMsg: ChatMessageItem = {
                      id: parsed.message.id || `asst-${Date.now()}`,
                      sessionId: currentSessionId,
                      role: 'assistant',
                      content: parsed.message.content || accumulated,
                      citations: parsed.message.citations || null,
                      intent: parsed.message.intent || null,
                      latencyMs: parsed.message.latencyMs || null,
                      createdAt: new Date().toISOString(),
                    };

                    queryClient.setQueryData(
                      ['chat-session', repositoryId, currentSessionId],
                      (old: ChatSessionItem | null) => {
                        if (!old) return old;
                        return {
                          ...old,
                          messages: [...(old.messages || []), finalAssistantMsg],
                        };
                      },
                    );
                  }
                }
              } catch {}
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Chat stream failed:', err);
          setStreamingContent(
            (prev) => prev + `\n\n*(Error: ${err.message || 'Stream failed'})*`,
          );
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent('');
        abortControllerRef.current = null;
        refetchActiveSession();
        refetchSessions();
      }
    },
    [
      activeSessionId,
      repositoryId,
      isStreaming,
      createSessionMutation,
      queryClient,
      refetchActiveSession,
      refetchSessions,
    ],
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    sessions,
    sessionsLoading,
    activeSessionId,
    setActiveSessionId,
    activeSession,
    messagesLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    stopStreaming,
    createSession: (title?: string) => createSessionMutation.mutate(title),
    deleteSession: (id: string) => deleteSessionMutation.mutate(id),
  };
}
