import type { Plugin } from "vite";
import { createServer } from "http";
import type { Server as HTTPServer } from "http";
import { setupSocketIO } from "./socket";

let httpServer: HTTPServer | null = null;

export function socketIOPlugin(): Plugin {
  return {
    name: "socket-io-server",
    configureServer(server) {
      if (!httpServer) {
        httpServer = createServer();
        setupSocketIO(httpServer);
        httpServer.listen(3001, () => {
          console.log("Socket.IO server running on ws://localhost:3001");
        });
      }

      server.httpServer?.on("upgrade", (request, socket, head) => {
        // Let the Socket.IO server handle upgrades on its own port
      });
    },
  };
}
