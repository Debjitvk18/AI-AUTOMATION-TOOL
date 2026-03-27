import { task } from "@trigger.dev/sdk";

/** Used for Text / Upload nodes so every graph step is a Trigger.dev run. */
export const passthroughTask = task({
  id: "passthrough-node",
  retry: { maxAttempts: 1 },
  run: async (payload: { body: Record<string, unknown> }) => {
    return payload.body;
  },
});
