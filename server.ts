import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import ytdl from "@distube/ytdl-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // YouTube Audio Extraction
  app.get("/api/youtube", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      if (!ytdl.validateURL(videoUrl)) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      const info = await ytdl.getInfo(videoUrl);
      const audioFormat = ytdl.chooseFormat(info.formats, {
        quality: "highestaudio",
        filter: "audioonly",
      });

      if (!audioFormat) {
        return res.status(404).json({ error: "No audio format found" });
      }

      // Stream the audio back to the client
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Access-Control-Allow-Origin", "*");
      ytdl(videoUrl, { format: audioFormat }).pipe(res);
    } catch (error: any) {
      console.error("YouTube error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Video Info
  app.get("/api/youtube-info", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ error: "URL is required" });

    try {
      const info = await ytdl.getInfo(videoUrl);
      res.json({
        title: info.videoDetails.title,
        author: info.videoDetails.author.name,
        thumbnail: info.videoDetails.thumbnails[0].url,
        duration: info.videoDetails.lengthSeconds,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
