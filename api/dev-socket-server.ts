import { createServer } from "http";
import { setupSocketIO } from "./socket";

const httpServer = createServer();
setupSocketIO(httpServer);

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Socket.IO dev server running on ws://localhost:${port}`);
});
