import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import ytdl from "@distube/ytdl-core";

interface VideoFormat {
  itag: number;
  quality: string;
  qualityLabel: string;
  mimeType: string;
  hasVideo: boolean;
  hasAudio: boolean;
  url: string;
  bitrate?: number;
  fps?: number;
  width?: number;
  height?: number;
  audioBitrate?: number;
}

interface VideoInfo {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: number;
  formats: VideoFormat[];
}

export const youtubeRouter = createRouter({
  info: publicQuery
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }): Promise<VideoInfo> => {
      try {
        const videoId = ytdl.getVideoID(input.url);
        const info = await ytdl.getInfo(videoId);

        const formats: VideoFormat[] = info.formats
          .filter((f) => f.url && f.mimeType)
          .map((f) => ({
            itag: f.itag,
            quality: f.quality || "unknown",
            qualityLabel: f.qualityLabel || f.quality || "unknown",
            mimeType: f.mimeType?.split(";")[0] || "",
            hasVideo: f.hasVideo,
            hasAudio: f.hasAudio,
            url: f.url,
            bitrate: f.bitrate || undefined,
            fps: f.fps || undefined,
            width: f.width || undefined,
            height: f.height || undefined,
            audioBitrate: f.audioBitrate || undefined,
          }))
          .sort((a, b) => {
            const heightA = a.height || 0;
            const heightB = b.height || 0;
            if (heightB !== heightA) return heightB - heightA;
            return (b.bitrate || 0) - (a.bitrate || 0);
          });

        return {
          videoId,
          title: info.videoDetails.title,
          author: info.videoDetails.author.name,
          thumbnail:
            info.videoDetails.thumbnails.pop()?.url ||
            `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
          duration: parseInt(info.videoDetails.lengthSeconds) || 0,
          formats,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Video unavailable")) {
          throw new Error("Video unavailable. It may be private, deleted, or region-blocked.");
        }
        if (message.includes("is not a YouTube domain")) {
          throw new Error("Invalid YouTube URL. Please provide a valid YouTube link.");
        }
        throw new Error(`Failed to get video info: ${message}`);
      }
    }),

  getStreamUrl: publicQuery
    .input(
      z.object({
        url: z.string().url(),
        quality: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const videoId = ytdl.getVideoID(input.url);
        const info = await ytdl.getInfo(videoId);

        let format;
        if (input.quality) {
          const targetHeight = parseInt(input.quality.replace("p", ""));
          const matchingFormats = info.formats.filter(
            (f) =>
              f.height === targetHeight &&
              f.hasVideo &&
              f.hasAudio
          );
          if (matchingFormats.length > 0) {
            format = matchingFormats[0];
          }
        }

        if (!format) {
          format = ytdl.chooseFormat(info.formats, {
            quality: "highest",
            filter: "audioandvideo",
          });
        }

        return {
          url: format.url,
          itag: format.itag,
          quality: format.qualityLabel || format.quality,
          mimeType: format.mimeType?.split(";")[0] || "",
          hasVideo: format.hasVideo,
          hasAudio: format.hasAudio,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to get stream URL: ${message}`);
      }
    }),
});
