import { ffmpeg } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_placeholder_set_TRIGGER_PROJECT_REF",
  dirs: ["./trigger"],
  maxDuration: 3600,
  build: {
    extensions: [
      ffmpeg({ version: "7" }),
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma",
        migrate: false,
      }),
    ],
    external: ["fluent-ffmpeg"],
  },
});
