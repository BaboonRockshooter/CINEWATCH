import { createRouter, publicQuery } from "./middleware";
import { youtubeRouter } from "./youtube";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  youtube: youtubeRouter,
});

export type AppRouter = typeof appRouter;
