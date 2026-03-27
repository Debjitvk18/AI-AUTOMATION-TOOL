import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { task } from "@trigger.dev/sdk";
import { uploadBufferToTransloadit } from "../lib/transloadit";

export type CropImagePayload = {
  workflowRunId: string;
  nodeId: string;
  userId: string;
  imageUrl: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
};

function ensureFfmpeg() {
  if (process.env.FFMPEG_PATH) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
  }
  if (process.env.FFPROBE_PATH) {
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
  }
}

export const cropImageTask = task({
  id: "crop-image",
  machine: { preset: "medium-1x" },
  retry: { maxAttempts: 1 },
  run: async (payload: CropImagePayload) => {
    ensureFfmpeg();
    const res = await fetch(payload.imageUrl);
    if (!res.ok) throw new Error("Could not download source image");
    const buf = Buffer.from(await res.arrayBuffer());
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nf-crop-"));
    const inputPath = path.join(dir, "in");
    const outputPath = path.join(dir, "out.png");
    await fs.writeFile(inputPath, buf);

    const { xPercent, yPercent, widthPercent, heightPercent } = payload;
    const vf = `crop=iw*${widthPercent}/100:ih*${heightPercent}/100:iw*${xPercent}/100:ih*${yPercent}/100`;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(["-vf", vf])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    const outBuf = await fs.readFile(outputPath);
    const url = await uploadBufferToTransloadit(outBuf, "cropped.png", "image/png");
    return { output: url };
  },
});
