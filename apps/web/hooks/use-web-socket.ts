import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function connect() {
      const storedKey = localStorage.getItem('prbot_app_key');
      const validAppKey = storedKey && storedKey.startsWith('prbot_') ? storedKey : null;

      // Derive ws:// or wss:// URL from current window location or NEXT_PUBLIC_API_URL
      const isSecure = window.location.protocol === 'https:';
      const wsProtocol = isSecure ? 'wss:' : 'ws:';
      
      let wsHost = window.location.host;
      // In dev with separate ports, check if api host is different
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (apiUrl && apiUrl.startsWith('http')) {
        try {
          const parsed = new URL(apiUrl);
          wsHost = parsed.host;
        } catch {
          // fallback to window.location.host
        }
      }

      const wsUrl = validAppKey
        ? `${wsProtocol}//${wsHost}/ws?key=${encodeURIComponent(validAppKey)}`
        : `${wsProtocol}//${wsHost}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Auto reconnect after 3 seconds
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as WebSocketMessage;
            
            if (payload.event === 'review:status-changed') {
              queryClient.invalidateQueries({ queryKey: ['review-jobs'] });
              if (payload.data?.reviewJobId) {
                queryClient.invalidateQueries({
                  queryKey: ['review-jobs', payload.data.reviewJobId],
                });
              }
            } else if (payload.event === 'repo:index-changed' || payload.event === 'repo:index-error') {
              queryClient.invalidateQueries({ queryKey: ['repositories'] });
              if (payload.data?.repositoryId) {
                queryClient.invalidateQueries({
                  queryKey: ['repositories', payload.data.repositoryId],
                });
              }
            }
          } catch {
            // Ignore parse errors on malformed messages
          }
        };
      } catch {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(connect, 5000);
      }
    }

    connect();

    // Listen to storage event so if user adds/changes app key in settings, we reconnect immediately
    function handleStorageChange(e: StorageEvent) {
      if (e.key === 'prbot_app_key') {
        if (wsRef.current) {
          wsRef.current.close();
        }
        connect();
      }
    }
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  return { isConnected };
}
