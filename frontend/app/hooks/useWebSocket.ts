import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketReturn {
  sendMessage: (message: any) => void;
  isConnected: boolean;
  lastMessage: MessageEvent<any> | null;
  error: string | null;
  connect: () => void;
}

const useWebSocket = (url: string): UseWebSocketReturn => {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    try {
      console.log(`Attempting to connect to: ${url}`);
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('✅ WebSocket Connected');
        setIsConnected(true);
        setError(null);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      socket.onmessage = (event: MessageEvent) => {
        console.log('📨 WebSocket Message:', event.data);
        setLastMessage(event);
      };

      socket.onerror = (event: Event) => {
        console.error('❌ WebSocket Error:', event);
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      socket.onclose = (event: CloseEvent) => {
        console.log(`🔌 WebSocket Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
        setIsConnected(false);
        
        if (event.code !== 1000) {
          console.log('Attempting to reconnect in 3 seconds...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to establish WebSocket connection');
    }
  }, [url]);

  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('📤 Sending message:', message);
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('⚠️ WebSocket is not connected. Message not sent.');
    setError('Cannot send message - WebSocket not connected');
    return false;
  }, []);

  useEffect(() => {
    connect();

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { 
    sendMessage, 
    isConnected, 
    lastMessage,
    error,
    connect
  };
};

export default useWebSocket;