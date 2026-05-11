import { useState, useCallback } from "react";
import { useSocket } from "./useSocket";

export interface ChatMessage {
  message: string;
  sender: string;
  timestamp: number;
}

export interface Viewer {
  socketId: string;
  name: string;
  isHost: boolean;
  isOnline: boolean;
}

export function useRoom() {
  const socket = useSocket();
  const [roomCode, setRoomCode] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [quality, setQuality] = useState("auto");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [guestName, setGuestName] = useState("");
  const [isJoined, setIsJoined] = useState(false);

  const createRoom = useCallback(
    async (url: string, selectedQuality: string) => {
      try {
        const result = await socket.createRoom(url, selectedQuality);
        setRoomCode(result.roomCode);
        setRoomId(result.roomId);
        setIsHost(true);
        setVideoUrl(url);
        setQuality(selectedQuality);
        setIsJoined(true);
        return result;
      } catch (error) {
        throw error;
      }
    },
    [socket]
  );

  const joinRoom = useCallback(
    async (code: string) => {
      try {
        const result = await socket.joinRoom(code);
        setRoomCode(code);
        setRoomId(result.roomId);
        setIsHost(result.isHost);
        setVideoUrl(result.videoUrl);
        setQuality(result.quality);
        setCurrentTime(result.currentTime);
        setIsPlaying(result.isPlaying);
        setGuestName(result.guestName);
        setIsJoined(true);
        return result;
      } catch (error) {
        throw error;
      }
    },
    [socket]
  );

  const sendVideoAction = useCallback(
    (action: "play" | "pause", time: number) => {
      if (!roomId) return;
      socket.sendVideoAction(roomId, action, time);
    },
    [socket, roomId]
  );

  const sendSeek = useCallback(
    (time: number) => {
      if (!roomId) return;
      socket.sendSeek(roomId, time);
    },
    [socket, roomId]
  );

  const sendChatMessage = useCallback(
    (message: string) => {
      if (!roomId) return;
      const sender = isHost ? "Host" : guestName;
      socket.sendChatMessage(roomId, message, sender);
      setMessages((prev) => [
        ...prev,
        { message, sender, timestamp: Date.now() },
      ]);
    },
    [socket, roomId, isHost, guestName]
  );

  const changeQuality = useCallback(
    (newQuality: string) => {
      if (!roomId) return;
      setQuality(newQuality);
      socket.changeQuality(roomId, newQuality);
    },
    [socket, roomId]
  );

  const requestSync = useCallback(() => {
    if (!roomId) return;
    socket.requestSync(roomId);
  }, [socket, roomId]);

  return {
    roomCode,
    roomId,
    isHost,
    videoUrl,
    quality,
    currentTime,
    isPlaying,
    messages,
    viewers,
    guestName,
    isJoined,
    setCurrentTime,
    setIsPlaying,
    setMessages,
    setViewers,
    createRoom,
    joinRoom,
    sendVideoAction,
    sendSeek,
    sendChatMessage,
    changeQuality,
    requestSync,
    socket,
  };
}
