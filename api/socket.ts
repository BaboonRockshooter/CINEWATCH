import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

interface RoomState {
  videoUrl: string;
  isPlaying: boolean;
  currentTime: number;
  lastUpdateTime: number;
  hostSocketId: string;
  quality: string;
}

interface Viewer {
  socketId: string;
  name: string;
  isHost: boolean;
  isOnline: boolean;
}

const rooms = new Map<string, RoomState>();
const roomViewers = new Map<string, Map<string, Viewer>>();

function generateRoomCode(): string {
  const adjectives = ["alpha", "beta", "gamma", "delta", "neo", "zen", "nova", "echo", "flash", "storm"];
  const nouns = ["wolf", "eagle", "tiger", "falcon", "shark", "lion", "hawk", "bear", "lynx", "crow"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}-${noun}-${num}`;
}

export function setupSocketIO(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("create-room", (data: { videoUrl: string; quality?: string }, callback) => {
      const roomCode = generateRoomCode();
      const roomId = roomCode;

      const roomState: RoomState = {
        videoUrl: data.videoUrl,
        isPlaying: false,
        currentTime: 0,
        lastUpdateTime: Date.now(),
        hostSocketId: socket.id,
        quality: data.quality || "auto",
      };

      rooms.set(roomId, roomState);
      roomViewers.set(roomId, new Map());

      const viewers = roomViewers.get(roomId)!;
      viewers.set(socket.id, {
        socketId: socket.id,
        name: "Host",
        isHost: true,
        isOnline: true,
      });

      socket.join(roomId);

      callback({
        roomCode,
        roomId,
        isHost: true,
      });

      io.to(roomId).emit("viewers-updated", Array.from(viewers.values()));
    });

    socket.on("join-room", (data: { roomCode: string }, callback) => {
      const roomId = data.roomCode;
      const roomState = rooms.get(roomId);

      if (!roomState) {
        callback({ error: "Room not found" });
        return;
      }

      const viewers = roomViewers.get(roomId);
      if (!viewers) {
        callback({ error: "Room not found" });
        return;
      }

      const guestCount = Array.from(viewers.values()).filter((v) => !v.isHost).length;
      const guestName = `Guest-${String(guestCount + 1).padStart(3, "0")}`;

      viewers.set(socket.id, {
        socketId: socket.id,
        name: guestName,
        isHost: false,
        isOnline: true,
      });

      socket.join(roomId);

      callback({
        roomId,
        isHost: false,
        videoUrl: roomState.videoUrl,
        quality: roomState.quality,
        currentTime: roomState.currentTime,
        isPlaying: roomState.isPlaying,
        guestName,
      });

      io.to(roomId).emit("viewers-updated", Array.from(viewers.values()));

      socket.to(roomId).emit("viewer-joined", {
        name: guestName,
        socketId: socket.id,
      });
    });

    socket.on("video-action", (data: { roomId: string; action: string; currentTime: number; timestamp: number }) => {
      const roomState = rooms.get(data.roomId);
      if (!roomState) return;

      if (roomState.hostSocketId !== socket.id) {
        return;
      }

      roomState.isPlaying = data.action === "play";
      roomState.currentTime = data.currentTime;
      roomState.lastUpdateTime = Date.now();

      socket.to(data.roomId).emit("video-action", {
        action: data.action,
        currentTime: data.currentTime,
        timestamp: data.timestamp,
      });
    });

    socket.on("seek", (data: { roomId: string; currentTime: number }) => {
      const roomState = rooms.get(data.roomId);
      if (!roomState) return;

      if (roomState.hostSocketId !== socket.id) return;

      roomState.currentTime = data.currentTime;
      roomState.lastUpdateTime = Date.now();

      socket.to(data.roomId).emit("seek", {
        currentTime: data.currentTime,
      });
    });

    socket.on("sync-request", (data: { roomId: string }) => {
      const roomState = rooms.get(data.roomId);
      if (!roomState) return;

      const elapsed = (Date.now() - roomState.lastUpdateTime) / 1000;
      const currentTime = roomState.isPlaying
        ? roomState.currentTime + elapsed
        : roomState.currentTime;

      socket.emit("sync-state", {
        currentTime,
        isPlaying: roomState.isPlaying,
        videoUrl: roomState.videoUrl,
        quality: roomState.quality,
      });
    });

    socket.on("chat-message", (data: { roomId: string; message: string; sender: string }) => {
      const roomState = rooms.get(data.roomId);
      if (!roomState) return;

      io.to(data.roomId).emit("chat-message", {
        message: data.message,
        sender: data.sender,
        timestamp: Date.now(),
      });
    });

    socket.on("quality-change", (data: { roomId: string; quality: string }) => {
      const roomState = rooms.get(data.roomId);
      if (!roomState) return;
      if (roomState.hostSocketId !== socket.id) return;

      roomState.quality = data.quality;
      io.to(data.roomId).emit("quality-change", { quality: data.quality });
    });

    socket.on("disconnect", () => {
      for (const [roomId, viewers] of roomViewers.entries()) {
        if (viewers.has(socket.id)) {
          const viewer = viewers.get(socket.id)!;
          viewers.delete(socket.id);

          if (viewer.isHost) {
            const remainingViewers = Array.from(viewers.values());
            if (remainingViewers.length > 0) {
              const newHost = remainingViewers[0];
              newHost.isHost = true;
              const roomState = rooms.get(roomId);
              if (roomState) {
                roomState.hostSocketId = newHost.socketId;
              }
            } else {
              rooms.delete(roomId);
              roomViewers.delete(roomId);
              return;
            }
          }

          io.to(roomId).emit("viewers-updated", Array.from(viewers.values()));
          socket.to(roomId).emit("viewer-left", { name: viewer.name });
          break;
        }
      }
    });
  });

  return io;
}
