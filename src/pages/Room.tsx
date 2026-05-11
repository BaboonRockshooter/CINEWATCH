import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useRoom } from "@/hooks/useRoom";
import { trpc } from "@/providers/trpc";
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Copy,
  LogOut,
  Send,
  Crown,
  Circle,
  Loader2,
  AlertCircle,
} from "lucide-react";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Room() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const room = useRoom();

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);
  const lastActionRef = useRef<number>(0);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chatMessage, setChatMessage] = useState("");
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [error, setError] = useState("");
  const [isBuffering, setIsBuffering] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");

  const youtubeInfo = trpc.youtube.info.useMutation();
  const streamUrlQuery = trpc.youtube.getStreamUrl.useMutation();

  // Load video info and stream
  useEffect(() => {
    if (room.videoUrl && room.isJoined) {
      loadVideo(room.videoUrl, room.quality);
    }
  }, [room.videoUrl, room.isJoined]);

  const loadVideo = async (url: string, quality: string) => {
    setError("");
    setVideoLoaded(false);
    setIsBuffering(true);

    try {
      const info = await youtubeInfo.mutateAsync({ url });
      setVideoTitle(info.title);
      setYoutubeUrl(url);

      const stream = await streamUrlQuery.mutateAsync({ url, quality });

      if (videoRef.current) {
        videoRef.current.src = stream.url;
        videoRef.current.load();
        setSelectedQuality(stream.quality);
      }

      setVideoLoaded(true);
      setIsBuffering(false);
    } catch (err: any) {
      setError(err.message || "Failed to load video");
      setIsBuffering(false);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [room.messages]);

  // Sync state when joining
  useEffect(() => {
    if (room.isJoined && !room.isHost && room.currentTime > 0) {
      if (videoRef.current) {
        videoRef.current.currentTime = room.currentTime;
        if (room.isPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
    }
  }, [room.isJoined]);

  // Socket.IO event listeners
  useEffect(() => {
    if (!room.socket || !room.roomId) return;

    const unsubVideoAction = room.socket.on(
      "video-action",
      (data: { action: string; currentTime: number; timestamp: number }) => {
        const video = videoRef.current;
        if (!video) return;

        isSyncingRef.current = true;
        lastActionRef.current = Date.now();

        const timeDiff = Math.abs(video.currentTime - data.currentTime);
        if (timeDiff > 1) {
          video.currentTime = data.currentTime;
        }

        if (data.action === "play") {
          video.play().catch(() => {});
        } else {
          video.pause();
        }

        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      }
    );

    const unsubSeek = room.socket.on(
      "seek",
      (data: { currentTime: number }) => {
        const video = videoRef.current;
        if (!video) return;

        isSyncingRef.current = true;
        video.currentTime = data.currentTime;
        setProgress(data.currentTime);

        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      }
    );

    const unsubSync = room.socket.on(
      "sync-state",
      (data: {
        currentTime: number;
        isPlaying: boolean;
        videoUrl: string;
        quality: string;
      }) => {
        const video = videoRef.current;
        if (!video) return;

        if (video.src && data.videoUrl === youtubeUrl) {
          video.currentTime = data.currentTime;
          if (data.isPlaying) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      }
    );

    const unsubQuality = room.socket.on(
      "quality-change",
      (data: { quality: string }) => {
        setSelectedQuality(data.quality);
      }
    );

    const unsubChat = room.socket.on(
      "chat-message",
      (data: { message: string; sender: string; timestamp: number }) => {
        room.setMessages((prev) => [...prev, data]);
      }
    );

    const unsubViewers = room.socket.on(
      "viewer-joined",
      (_data: { name: string }) => {
        // Viewer joined notification handled via viewers-updated
      }
    );

    const unsubViewersList = room.socket.on(
      "viewers-updated",
      (data: any[]) => {
        room.setViewers(data);
      }
    );

    return () => {
      unsubVideoAction?.();
      unsubSeek?.();
      unsubSync?.();
      unsubQuality?.();
      unsubChat?.();
      unsubViewers?.();
      unsubViewersList?.();
    };
  }, [room.socket, room.roomId, youtubeUrl]);

  // Video event handlers
  const handlePlay = useCallback(() => {
    if (isSyncingRef.current) return;
    if (!room.isHost) return;
    const video = videoRef.current;
    if (!video) return;
    room.sendVideoAction("play", video.currentTime);
    setProgress(video.currentTime);
  }, [room]);

  const handlePause = useCallback(() => {
    if (isSyncingRef.current) return;
    if (!room.isHost) return;
    const video = videoRef.current;
    if (!video) return;
    room.sendVideoAction("pause", video.currentTime);
  }, [room]);

  const handleSeek = useCallback(() => {
    if (isSyncingRef.current) return;
    if (!room.isHost) return;
    const video = videoRef.current;
    if (!video) return;
    room.sendSeek(video.currentTime);
  }, [room]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setProgress(video.currentTime);
    setDuration(video.duration || 0);
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!room.isHost) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const video = videoRef.current;
      if (!video || !video.duration) return;
      const newTime = percent * video.duration;
      video.currentTime = newTime;
      room.sendSeek(newTime);
      setProgress(newTime);
    },
    [room]
  );

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.volume = volume || 1;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(() => {
    if (!playerRef.current) return;
    if (!isFullscreen) {
      playerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isBuffering) setShowControls(false);
    }, 3000);
  }, [isBuffering]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play();
            } else {
              videoRef.current.pause();
            }
          }
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "ArrowLeft":
          if (videoRef.current && room.isHost) {
            videoRef.current.currentTime -= 5;
            room.sendSeek(videoRef.current.currentTime);
          }
          break;
        case "ArrowRight":
          if (videoRef.current && room.isHost) {
            videoRef.current.currentTime += 5;
            room.sendSeek(videoRef.current.currentTime);
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleFullscreen, toggleMute, room]);

  const handleSendMessage = useCallback(() => {
    if (!chatMessage.trim()) return;
    room.sendChatMessage(chatMessage.trim());
    setChatMessage("");
  }, [chatMessage, room]);

  const handleCopyRoomCode = useCallback(() => {
    if (roomCode) {
      const url = `${window.location.origin}/?room=${roomCode}`;
      navigator.clipboard.writeText(url).then(() => {
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      });
    }
  }, [roomCode]);

  const handleLeave = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleQualityChange = useCallback(
    (quality: string) => {
      setShowQualityMenu(false);
      setSelectedQuality(quality);
      if (room.isHost && youtubeUrl) {
        room.changeQuality(quality);
      }
    },
    [room, youtubeUrl]
  );

  if (!room.isJoined) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#c8a45c] animate-spin mx-auto mb-4" />
          <p className="text-[#9a9590] text-sm">Joining room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#f0ece4] flex flex-col">
      {/* Top Bar */}
      <header className="h-[52px] bg-[#141416] border-b border-[#222225] flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-[#c8a45c] fill-[#c8a45c]" />
          <span className="text-[#f0ece4] text-sm font-bold tracking-[0.08em] uppercase">
            CINEWATCH
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[#9a9590] text-xs">Room:</span>
          <code className="bg-[#0a0a0b] border border-[#222225] px-3 py-1 rounded-md text-xs text-[#f0ece4] font-mono">
            {roomCode}
          </code>
          <button
            onClick={handleCopyRoomCode}
            className="p-1.5 text-[#5c5855] hover:text-[#c8a45c] transition-colors"
            title="Copy room link"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyRoomCode}
            className="px-3 py-1.5 bg-[rgba(200,164,92,0.12)] border border-[rgba(200,164,92,0.2)] text-[#c8a45c] text-xs font-medium rounded-md hover:bg-[rgba(200,164,92,0.2)] transition-colors"
          >
            Share
          </button>
          <button
            onClick={handleLeave}
            className="px-3 py-1.5 border border-[#222225] text-[#9a9590] text-xs rounded-md hover:bg-[rgba(232,93,74,0.1)] hover:text-[#e85d4a] hover:border-[rgba(232,93,74,0.3)] transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed top-4 right-4 z-50 bg-[#141416] border border-[#222225] rounded-lg px-4 py-3 shadow-lg animate-in slide-in-from-right duration-300">
          <p className="text-[#6ba87c] text-xs">Room link copied!</p>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-[rgba(232,93,74,0.1)] border border-[rgba(232,93,74,0.3)] rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#e85d4a] shrink-0" />
            <p className="text-[#e85d4a] text-xs">{error}</p>
          </div>
        )}

        {/* Video Player Stage */}
        <div className="flex-1 flex items-center justify-center p-3 min-h-0">
          <div
            ref={playerRef}
            className="relative w-full max-w-[1200px] aspect-video bg-[#141416] rounded-xl overflow-hidden border border-[#222225] shadow-[0_0_60px_rgba(0,0,0,0.6),0_0_120px_rgba(0,0,0,0.3)]"
            onMouseMove={resetControlsTimeout}
            onMouseLeave={() => setShowControls(false)}
          >
            {/* Video Element */}
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              onPlay={handlePlay}
              onPause={handlePause}
              onSeeked={handleSeek}
              onTimeUpdate={handleTimeUpdate}
              onWaiting={() => setIsBuffering(true)}
              onCanPlay={() => setIsBuffering(false)}
              onLoadedData={() => {
                setVideoLoaded(true);
                setIsBuffering(false);
              }}
              playsInline
            />

            {/* Loading state */}
            {(!videoLoaded || isBuffering) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141416]">
                <div className="w-8 h-8 border-2 border-[#c8a45c] border-t-transparent rounded-full animate-spin" />
                {!videoLoaded ? (
                  <p className="text-[#9a9590] text-xs mt-3">Loading video...</p>
                ) : (
                  <p className="text-[#9a9590] text-xs mt-3">Buffering...</p>
                )}
              </div>
            )}

            {/* Paused overlay */}
            {videoLoaded && !isBuffering && videoRef.current?.paused && (
              <div className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                onClick={() => {
                  if (room.isHost) {
                    videoRef.current?.play();
                  }
                }}
              >
                <div className="w-16 h-16 rounded-full bg-[rgba(200,164,92,0.15)] backdrop-blur-sm border border-[rgba(200,164,92,0.3)] flex items-center justify-center">
                  <Play className="w-6 h-6 text-[#c8a45c] fill-[#c8a45c] ml-1" />
                </div>
                {!room.isHost && (
                  <p className="text-[#5c5855] text-xs mt-3">
                    Waiting for host to resume
                  </p>
                )}
              </div>
            )}

            {/* Floating Controls */}
            <div
              className="absolute bottom-0 left-0 right-0 px-5 pb-3 pt-10 transition-all duration-250"
              style={{
                background: "linear-gradient(to top, rgba(10,10,11,0.9) 0%, rgba(10,10,11,0.6) 60%, transparent 100%)",
                opacity: showControls ? 1 : 0,
                transform: showControls ? "translateY(0)" : "translateY(4px)",
                pointerEvents: showControls ? "auto" : "none",
              }}
            >
              {/* Video title */}
              {videoTitle && (
                <p className="text-[#f0ece4] text-sm font-medium mb-2 truncate max-w-[80%]">
                  {videoTitle}
                </p>
              )}

              {/* Progress bar */}
              <div
                className="w-full h-[3px] bg-[rgba(255,255,255,0.12)] rounded-full cursor-pointer group mb-3"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full bg-[#c8a45c] rounded-full relative transition-all"
                  style={{
                    width: `${duration ? (progress / duration) * 100 : 0}%`,
                  }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#c8a45c] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Controls row */}
              <div className="flex items-center justify-between">
                {/* Left controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (room.isHost) {
                        if (videoRef.current?.paused) {
                          videoRef.current.play();
                        } else {
                          videoRef.current?.pause();
                        }
                      }
                    }}
                    className="w-7 h-7 rounded-full bg-[#c8a45c] flex items-center justify-center hover:bg-[#d4b76a] active:scale-95 transition-all disabled:opacity-40"
                    disabled={!room.isHost}
                  >
                    {videoRef.current?.paused ? (
                      <Play className="w-3 h-3 text-[#0a0a0b] fill-[#0a0a0b] ml-0.5" />
                    ) : (
                      <Pause className="w-3 h-3 text-[#0a0a0b]" />
                    )}
                  </button>

                  <span className="text-[#f0ece4] text-xs font-mono">
                    {formatTime(progress)}
                  </span>
                  <span className="text-[#5c5855] text-xs font-mono">/</span>
                  <span className="text-[#5c5855] text-xs font-mono">
                    {formatTime(duration)}
                  </span>

                  {/* Volume */}
                  <div className="flex items-center gap-2 group">
                    <button
                      onClick={toggleMute}
                      className="text-[#9a9590] hover:text-[#f0ece4] transition-colors"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 bg-[rgba(255,255,255,0.12)] rounded-full appearance-none cursor-pointer accent-[#c8a45c] opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-1">
                  {/* Quality selector */}
                  <div className="relative">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="px-2 py-1 text-[#9a9590] text-xs hover:text-[#f0ece4] transition-colors rounded"
                    >
                      {selectedQuality === "auto" ? "Auto" : selectedQuality}
                    </button>
                    {showQualityMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-[#141416] border border-[#222225] rounded-lg shadow-lg py-1 min-w-[100px] z-20">
                        {["Auto", "1080p", "720p", "480p", "360p"].map(
                          (q) => (
                            <button
                              key={q}
                              onClick={() => handleQualityChange(q.toLowerCase())}
                              className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${
                                selectedQuality === q.toLowerCase()
                                  ? "bg-[rgba(200,164,92,0.12)] text-[#c8a45c]"
                                  : "text-[#9a9590] hover:bg-[#1c1c1f]"
                              }`}
                            >
                              {q}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sync indicator */}
                  <div
                    className="flex items-center gap-1 px-2"
                    title="Synced"
                  >
                    <Circle className="w-2 h-2 text-[#6ba87c] fill-[#6ba87c]" />
                    <span className="text-[#6ba87c] text-[10px]">synced</span>
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 text-[#9a9590] hover:text-[#f0ece4] transition-colors"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-4 h-4" />
                    ) : (
                      <Maximize className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Host badge */}
            {room.isHost && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-[rgba(200,164,92,0.12)] rounded">
                <Crown className="w-3 h-3 text-[#c8a45c]" />
                <span className="text-[#c8a45c] text-[10px] font-medium">
                  HOST
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Panel */}
        <div className="h-[200px] shrink-0 grid grid-cols-[1fr_auto] border-t border-[#222225]">
          {/* Chat */}
          <div className="flex flex-col min-w-0">
            <div className="px-3 py-2 border-b border-[#222225] flex items-center justify-between">
              <span className="text-[#9a9590] text-xs uppercase tracking-wider">
                Chat
              </span>
              <span className="text-[#5c5855] text-xs">
                {room.messages.length} messages
              </span>
            </div>
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0"
            >
              {room.messages.length === 0 && (
                <p className="text-[#5c5855] text-xs text-center py-4">
                  No messages yet. Start the conversation!
                </p>
              )}
              {room.messages.map((msg, i) => (
                <div
                  key={i}
                  className="animate-in slide-in-from-bottom-1 duration-150"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[#c8a45c] text-xs font-medium">
                      {msg.sender}
                    </span>
                    <span className="text-[#5c5855] text-[10px]">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-[#9a9590] text-xs">{msg.message}</p>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-[#222225] flex items-center gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Send a message..."
                className="flex-1 bg-[#0a0a0b] border border-[#222225] rounded-md px-3 py-2 text-xs text-[#f0ece4] placeholder-[#5c5855] focus:border-[rgba(200,164,92,0.3)] focus:outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatMessage.trim()}
                className="w-7 h-7 bg-[#c8a45c] rounded-md flex items-center justify-center hover:bg-[#d4b76a] active:scale-95 transition-all disabled:opacity-30"
              >
                <Send className="w-3.5 h-3.5 text-[#0a0a0b]" />
              </button>
            </div>
          </div>

          {/* Viewers */}
          <div className="w-[200px] border-l border-[#222225] flex flex-col">
            <div className="px-3 py-2 border-b border-[#222225]">
              <span className="text-[#9a9590] text-xs uppercase tracking-wider">
                Viewers ({room.viewers.length})
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
              {room.viewers.map((viewer) => (
                <div
                  key={viewer.socketId}
                  className="flex items-center gap-2"
                >
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-[#1c1c1f] flex items-center justify-center text-[#9a9590] text-[10px] font-medium">
                      {viewer.name.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[#141416] ${
                        viewer.isOnline
                          ? "bg-[#6ba87c]"
                          : "bg-[#5c5855]"
                      }`}
                    />
                  </div>
                  <span className="text-[#f0ece4] text-xs truncate flex-1">
                    {viewer.name}
                  </span>
                  {viewer.isHost && (
                    <span className="text-[10px] text-[#c8a45c] bg-[rgba(200,164,92,0.12)] px-1.5 py-0.5 rounded">
                      HOST
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
