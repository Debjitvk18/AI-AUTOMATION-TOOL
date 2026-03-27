import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { task } from "@trigger.dev/sdk";
import { uploadBufferToTransloadit } from "../lib/transloadit";

export type ExtractFramePayload = {
  workflowRunId: string;
  nodeId: string;
  userId: string;
  videoUrl: string;
  /** seconds, or "42%" */
  timestamp: string;
};

function ensureFfmpeg() {
  if (process.env.FFMPEG_PATH) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
  }
  if (process.env.FFPROBE_PATH) {
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
  }
}

async function probeDurationSeconds(videoPath: string): Promise<number> {
  ensureFfmpeg();
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, data) => {
      if (err) return reject(err);
      const d = data.format?.duration;
      if (typeof d === "number" && !Number.isNaN(d)) resolve(d);
      else reject(new Error("Could not read video duration"));
    });
  });
}

export const extractFrameTask = task({
  id: "extract-frame",
  machine: { preset: "medium-1x" },
  retry: { maxAttempts: 1 },
  run: async (payload: ExtractFramePayload) => {
    ensureFfmpeg();
    const res = await fetch(payload.videoUrl);
    if (!res.ok) throw new Error("Could not download source video");
    const buf = Buffer.from(await res.arrayBuffer());
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nf-extract-"));
    const inputPath = path.join(dir, "in.mp4");
    const outputPath = path.join(dir, "frame.png");
    await fs.writeFile(inputPath, buf);

    const tsRaw = payload.timestamp.trim();
    let seekSeconds = 0;
    if (tsRaw.endsWith("%")) {
      const pct = Number.parseFloat(tsRaw.slice(0, -1));
      if (Number.isNaN(pct)) throw new Error("Invalid timestamp percentage");
      const dur = await probeDurationSeconds(inputPath);
      seekSeconds = (dur * pct) / 100;
    } else {
      seekSeconds = Number.parseFloat(tsRaw);
      if (Number.isNaN(seekSeconds)) throw new Error("Invalid timestamp");
    }

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(seekSeconds)
        .outputOptions(["-vframes", "1"])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    const outBuf = await fs.readFile(outputPath);
    const url = await uploadBufferToTransloadit(outBuf, "frame.png", "image/png");
    return { output: url };
  },
});
