import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useRoom } from "@/hooks/useRoom";
import { trpc } from "@/providers/trpc";
import {
  Play,
  Users,
  Zap,
  ArrowRight,
  Monitor,
  Wifi,
} from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("room");

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [roomCode, setRoomCode] = useState(inviteCode || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"create" | "join">(
    inviteCode ? "join" : "create"
  );
  const [showPreloader, setShowPreloader] = useState(true);
  const [preloaderPhase, setPreloaderPhase] = useState(0);

  const room = useRoom();
  const youtubeInfo = trpc.youtube.info.useMutation();

  useEffect(() => {
    if (room.isJoined && room.roomCode) {
      navigate(`/room/${room.roomCode}`);
    }
  }, [room.isJoined, room.roomCode, navigate]);

  useEffect(() => {
    const t1 = setTimeout(() => setPreloaderPhase(1), 100);
    const t2 = setTimeout(() => setPreloaderPhase(2), 2500);
    const t3 = setTimeout(() => setShowPreloader(false), 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const validateYouTubeUrl = (url: string): boolean => {
    const pattern =
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return pattern.test(url);
  };

  const handleCreateRoom = async () => {
    setError("");
    if (!validateYouTubeUrl(youtubeUrl)) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    setIsLoading(true);
    try {
      await youtubeInfo.mutateAsync({ url: youtubeUrl });
      await room.createRoom(youtubeUrl, "auto");
    } catch (err: any) {
      setError(err.message || "Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    setError("");
    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    setIsLoading(true);
    try {
      await room.joinRoom(roomCode.trim());
    } catch (err: any) {
      setError(err.message || "Failed to join room");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#f0ece4] relative overflow-hidden">
      {/* Preloader */}
      {showPreloader && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0b] flex items-center justify-center">
          <div className="relative flex items-center">
            <span
              className="text-2xl font-bold tracking-[0.1em] uppercase transition-all duration-500"
              style={{
                opacity: preloaderPhase >= 1 ? 1 : 0,
                transform:
                  preloaderPhase >= 2
                    ? "translateX(-2.5vw)"
                    : "translateX(-30vw)",
                transition: "all 2000ms cubic-bezier(0.65, 0, 0.35, 1)",
              }}
            >
              CINE
            </span>
            <div
              className="mx-3 h-[1px] bg-[#c8a45c] transition-all"
              style={{
                width: preloaderPhase >= 2 ? "60px" : "0px",
                opacity: preloaderPhase >= 2 ? 1 : 0,
                transition: "all 1500ms cubic-bezier(0.65, 0, 0.35, 1)",
                transitionDelay: preloaderPhase >= 2 ? "0ms" : "0ms",
              }}
            />
            <span
              className="text-2xl font-bold tracking-[0.1em] uppercase transition-all duration-500"
              style={{
                opacity: preloaderPhase >= 1 ? 1 : 0,
                transform:
                  preloaderPhase >= 2
                    ? "translateX(2.5vw)"
                    : "translateX(30vw)",
                transition: "all 2000ms cubic-bezier(0.65, 0, 0.35, 1)",
              }}
            >
              WATCH
            </span>
          </div>
        </div>
      )}

      {/* Background particles canvas */}
      <canvas
        id="particle-canvas"
        className="fixed inset-0 pointer-events-none z-0"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-[52px] bg-[#141416] border-b border-[#222225] flex items-center px-5">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-[#c8a45c] fill-[#c8a45c]" />
            <span className="text-[#f0ece4] text-sm font-bold tracking-[0.08em] uppercase">
              CINEWATCH
            </span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="max-w-[440px] w-full">
            {/* Branding */}
            <div className="text-center mb-10">
              <h1 className="text-3xl font-semibold text-[#f0ece4] tracking-tight mb-3">
                Watch together, anywhere
              </h1>
              <p className="text-[#9a9590] text-sm">
                Synchronized YouTube viewing with friends in real-time
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {[
                { icon: Zap, label: "Real-time sync" },
                { icon: Monitor, label: "Up to 1080p" },
                { icon: Wifi, label: "Local server" },
                { icon: Users, label: "Unlimited viewers" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141416] border border-[#222225] rounded-md"
                >
                  <Icon className="w-3 h-3 text-[#c8a45c]" />
                  <span className="text-[#9a9590] text-xs">{label}</span>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-[#141416] border border-[#222225] rounded-lg mb-6">
              <button
                onClick={() => {
                  setMode("create");
                  setError("");
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                  mode === "create"
                    ? "bg-[#c8a45c] text-[#0a0a0b]"
                    : "text-[#9a9590] hover:text-[#f0ece4]"
                }`}
              >
                Create Room
              </button>
              <button
                onClick={() => {
                  setMode("join");
                  setError("");
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                  mode === "join"
                    ? "bg-[#c8a45c] text-[#0a0a0b]"
                    : "text-[#9a9590] hover:text-[#f0ece4]"
                }`}
              >
                Join Room
              </button>
            </div>

            {/* Create Room Form */}
            {mode === "create" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[#9a9590] text-xs uppercase tracking-wide mb-2">
                    YouTube URL
                  </label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      setError("");
                    }}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-[#0a0a0b] border border-[#222225] rounded-lg px-4 py-3 text-sm text-[#f0ece4] placeholder-[#5c5855] focus:border-[rgba(200,164,92,0.4)] focus:outline-none focus:ring-2 focus:ring-[rgba(200,164,92,0.08)] transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateRoom();
                    }}
                  />
                </div>

                {error && (
                  <p className="text-[#e85d4a] text-xs">{error}</p>
                )}

                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="w-full bg-[#c8a45c] text-[#0a0a0b] text-sm font-semibold py-3 rounded-lg hover:bg-[#d4b76a] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-[#0a0a0b] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Create Watch Party
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Join Room Form */}
            {mode === "join" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[#9a9590] text-xs uppercase tracking-wide mb-2">
                    Room Code
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value);
                      setError("");
                    }}
                    placeholder="e.g. alpha-wolf-927"
                    className="w-full bg-[#0a0a0b] border border-[#222225] rounded-lg px-4 py-3 text-sm text-[#f0ece4] placeholder-[#5c5855] focus:border-[rgba(200,164,92,0.4)] focus:outline-none focus:ring-2 focus:ring-[rgba(200,164,92,0.08)] transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoinRoom();
                    }}
                  />
                </div>

                {error && (
                  <p className="text-[#e85d4a] text-xs">{error}</p>
                )}

                <button
                  onClick={handleJoinRoom}
                  disabled={isLoading}
                  className="w-full bg-[#c8a45c] text-[#0a0a0b] text-sm font-semibold py-3 rounded-lg hover:bg-[#d4b76a] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-[#0a0a0b] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Join Room
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* How it works */}
            <div className="mt-12 space-y-4">
              <p className="text-[#5c5855] text-xs uppercase tracking-wide text-center">
                How it works
              </p>
              {[
                {
                  step: "01",
                  title: "Paste a YouTube link",
                  desc: "Any public YouTube video URL",
                },
                {
                  step: "02",
                  title: "Create your room",
                  desc: "Get a unique room code to share",
                },
                {
                  step: "03",
                  title: "Watch together",
                  desc: "Everyone sees the same frame, perfectly synced",
                },
              ].map(({ step, title, desc }) => (
                <div
                  key={step}
                  className="flex items-start gap-4 p-4 bg-[#141416] border border-[#222225] rounded-lg"
                >
                  <span className="text-[#c8a45c] text-xs font-mono font-medium mt-0.5">
                    {step}
                  </span>
                  <div>
                    <p className="text-[#f0ece4] text-sm font-medium">
                      {title}
                    </p>
                    <p className="text-[#9a9590] text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 text-center border-t border-[#222225]">
          <p className="text-[#5c5855] text-xs">
            CINEWATCH — Synchronized viewing for everyone
          </p>
        </footer>
      </div>

      {/* Particle script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const canvas = document.getElementById('particle-canvas');
              if (!canvas) return;
              const ctx = canvas.getContext('2d');
              canvas.width = window.innerWidth;
              canvas.height = window.innerHeight;
              
              const particles = [];
              const count = window.innerWidth < 768 ? 80 : 200;
              
              for (let i = 0; i < count; i++) {
                particles.push({
                  x: Math.random() * canvas.width,
                  y: Math.random() * canvas.height,
                  size: 0.5 + Math.random() * 1.5,
                  speed: 0.2 + Math.random() * 0.5,
                  opacity: 0.1 + Math.random() * 0.4,
                });
              }
              
              let mouseX = canvas.width / 2;
              let mouseY = canvas.height / 2;
              
              document.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
              });
              
              function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                particles.forEach((p) => {
                  p.y -= p.speed;
                  if (p.y < -10) p.y = canvas.height + 10;
                  
                  const dx = (mouseX - canvas.width / 2) * 0.001;
                  const dy = (mouseY - canvas.height / 2) * 0.001;
                  p.x += dx * p.speed;
                  
                  ctx.beginPath();
                  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                  ctx.fillStyle = \`rgba(200, 164, 92, \${p.opacity})\`;
                  ctx.fill();
                });
                
                requestAnimationFrame(animate);
              }
              
              animate();
              
              window.addEventListener('resize', () => {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
              });
            })();
          `,
        }}
      />
    </div>
  );
}
