import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createServer } from "http";
import { setupSocketIO } from "./socket";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const httpServer = createServer((req, res) => {
    const fetchResponse = app.fetch(req as any);
    if (fetchResponse instanceof Promise) {
      fetchResponse.then((response) => {
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        res.statusCode = response.status;
        response.body?.pipeTo(
          new WritableStream({
            write(chunk) {
              res.write(chunk);
            },
            close() {
              res.end();
            },
          })
        ).catch(() => res.end());
      }).catch(() => {
        res.statusCode = 500;
        res.end("Internal Server Error");
      });
    }
  });

  setupSocketIO(httpServer);

  const port = parseInt(process.env.PORT || "3000");
  httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
