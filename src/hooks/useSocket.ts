import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.DEV ? "ws://localhost:3001" : "/";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const createRoom = useCallback(
    (videoUrl: string, quality?: string): Promise<{ roomCode: string; roomId: string; isHost: boolean }> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error("Socket not connected"));
          return;
        }
        socketRef.current.emit("create-room", { videoUrl, quality }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
    },
    []
  );

  const joinRoom = useCallback(
    (roomCode: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error("Socket not connected"));
          return;
        }
        socketRef.current.emit("join-room", { roomCode }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
    },
    []
  );

  const sendVideoAction = useCallback(
    (roomId: string, action: "play" | "pause", currentTime: number) => {
      if (!socketRef.current) return;
      socketRef.current.emit("video-action", {
        roomId,
        action,
        currentTime,
        timestamp: Date.now(),
      });
    },
    []
  );

  const sendSeek = useCallback(
    (roomId: string, currentTime: number) => {
      if (!socketRef.current) return;
      socketRef.current.emit("seek", { roomId, currentTime });
    },
    []
  );

  const sendChatMessage = useCallback(
    (roomId: string, message: string, sender: string) => {
      if (!socketRef.current) return;
      socketRef.current.emit("chat-message", { roomId, message, sender });
    },
    []
  );

  const changeQuality = useCallback(
    (roomId: string, quality: string) => {
      if (!socketRef.current) return;
      socketRef.current.emit("quality-change", { roomId, quality });
    },
    []
  );

  const requestSync = useCallback(
    (roomId: string) => {
      if (!socketRef.current) return;
      socketRef.current.emit("sync-request", { roomId });
    },
    []
  );

  const on = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      if (!socketRef.current) return () => {};
      socketRef.current.on(event, callback);
      return () => {
        socketRef.current?.off(event, callback);
      };
    },
    []
  );

  const off = useCallback(
    (event: string, callback?: (...args: any[]) => void) => {
      if (!socketRef.current) return;
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    },
    []
  );

  return {
    socket: socketRef,
    createRoom,
    joinRoom,
    sendVideoAction,
    sendSeek,
    sendChatMessage,
    changeQuality,
    requestSync,
    on,
    off,
  };
}
