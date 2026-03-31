import { task } from "@trigger.dev/sdk";

export type SendNotificationPayload = {
  notifType: string; // "webhook" | "console"
  webhookUrl?: string;
  message: string;
};

export const sendNotificationTask = task({
  id: "send-notification",
  maxDuration: 30,
  run: async (payload: SendNotificationPayload) => {
    const { notifType, webhookUrl, message } = payload;

    console.log(`[send-notification] Type: ${notifType}, Message length: ${message.length}`);

    if (notifType === "webhook") {
      if (!webhookUrl) throw new Error("Webhook URL is required for webhook notifications");

      console.log(`[send-notification] Sending webhook to: ${webhookUrl}`);
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message, message }),
      });

      const status = `${res.status} ${res.statusText}`;
      console.log(`[send-notification] Webhook response: ${status}`);

      return { text: `Notification sent: ${status}`, status };
    }

    if (notifType === "console") {
      console.log(`[send-notification] Console notification: ${message}`);
      return { text: `Console: ${message}`, status: "logged" };
    }

    throw new Error(`Unsupported notification type: ${notifType}`);
  },
});
