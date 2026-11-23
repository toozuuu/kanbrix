import { useEffect, useRef, useState } from 'react';

type WebSocketMessage = string | ArrayBuffer | Blob;

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
}

export function useWebSocket(
  url: string | null,
  options: UseWebSocketOptions = {}
) {
  const {
    onMessage,
    reconnect = true,
    reconnectInterval = 3000,
    reconnectAttempts = 5,
  } = options;

  const [connected, setConnected] = useState(false);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(reconnect);

  useEffect(() => {
    if (!url) {
      setConnected(false);
      setReadyState(WebSocket.CLOSED);
      return;
    }

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setReadyState(WebSocket.OPEN);
        reconnectAttemptsRef.current = 0;
        shouldReconnectRef.current = reconnect;
      };

      ws.onmessage = (event) => {
        onMessage?.(event.data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        setConnected(false);
        setReadyState(WebSocket.CLOSED);

        if (shouldReconnectRef.current && reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
        }
      };
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url, onMessage, reconnect, reconnectInterval, reconnectAttempts]);

  const sendMessage = (data: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
      return true;
    }
    return false;
  };

  const close = () => {
    shouldReconnectRef.current = false;
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  return { connected, readyState, sendMessage, close };
}