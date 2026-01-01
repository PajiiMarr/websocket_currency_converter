// useWebSocket.ts
import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketReturn {
  sendMessage: (message: any) => void;
  isConnected: boolean;
  lastMessage: MessageEvent<any> | null;
  socket: WebSocket | null;
}

const useWebSocket = (url: string): UseWebSocketReturn => {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent<any> | null>(null);

  useEffect(() => {
    // Create the WebSocket connection
    socketRef.current = new WebSocket(url);

    // Handle connection opening
    socketRef.current.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    // Handle messages
    socketRef.current.onmessage = (event: MessageEvent) => {
      console.log('WebSocket Message Received:', event.data);
      setLastMessage(event);
    };

    // Handle errors
    socketRef.current.onerror = (error: Event) => {
      console.error('WebSocket Error:', error);
      setIsConnected(false);
    };

    // Handle connection closing
    socketRef.current.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
    };

    // Cleanup function: Close the connection when the component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [url]); // Re-run if the URL changes

  // Function to send messages
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket is not connected. Message not sent.');
    return false;
  }, []);

  return { 
    sendMessage, 
    isConnected, 
    lastMessage,
    socket: socketRef.current 
  };
};

export default useWebSocket;