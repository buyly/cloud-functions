import * as logger from "firebase-functions/logger";
import {Expo, ExpoPushMessage, ExpoPushTicket} from "expo-server-sdk";

interface SendPushNotificationParams {
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

/**
 * Helper function to send a push notification using Expo.
 * @param {SendPushNotificationParams} params
 * The push notification parameters.
 * @return {Promise<ExpoPushTicket | null>}
 * The ticket from Expo or null if the send fails.
 */
export async function sendPushNotification(
  params: SendPushNotificationParams
): Promise<ExpoPushTicket | null> {
  const {
    pushToken,
    title,
    body,
    data = {},
    sound = "default",
    badge,
    channelId,
    priority = "high",
  } = params;

  try {
    // Create a new Expo SDK client
    const expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true,
    });

    // Check that the push token is valid
    if (!Expo.isExpoPushToken(pushToken)) {
      logger.warn(`Push token ${pushToken} is not a valid Expo push token`);
      return null;
    }

    // Construct the message
    const message: ExpoPushMessage = {
      to: pushToken,
      sound,
      title,
      body,
      data,
      priority,
      ...(badge !== undefined && {badge}),
      ...(channelId && {channelId}),
    };

    logger.info(`Sending push notification to ${pushToken}`, {
      title,
      body,
    });

    // Send the notification
    const tickets = await expo.sendPushNotificationsAsync([message]);

    if (tickets.length > 0) {
      const ticket = tickets[0];
      if (ticket.status === "ok") {
        logger.info(
          `Successfully sent push notification. Ticket ID: ${ticket.id}`
        );
        return ticket;
      } else if (ticket.status === "error") {
        logger.error(
          `Error sending push notification: ${ticket.message}`,
          ticket.details
        );
        return null;
      }
    }

    return null;
  } catch (error) {
    logger.error("Error in sendPushNotification:", error);
    return null;
  }
}

interface SendBulkPushNotificationsParams {
  pushTokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

/**
 * Helper function to send push notifications to multiple devices.
 * @param {SendBulkPushNotificationsParams} params
 * The push notification parameters with multiple tokens.
 * @return {Promise<ExpoPushTicket[]>}
 * Array of tickets from Expo.
 */
export async function sendBulkPushNotifications(
  params: SendBulkPushNotificationsParams
): Promise<ExpoPushTicket[]> {
  const {
    pushTokens,
    title,
    body,
    data = {},
    sound = "default",
    badge,
    channelId,
    priority = "high",
  } = params;

  try {
    // Create a new Expo SDK client
    const expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true,
    });

    // Create the messages array
    const messages: ExpoPushMessage[] = [];

    for (const pushToken of pushTokens) {
      // Check that all push tokens are valid
      if (!Expo.isExpoPushToken(pushToken)) {
        logger.warn(`Push token ${pushToken} is not a valid Expo push token`);
        continue;
      }

      // Construct a message
      messages.push({
        to: pushToken,
        sound,
        title,
        body,
        data,
        priority,
        ...(badge !== undefined && {badge}),
        ...(channelId && {channelId}),
      });
    }

    if (messages.length === 0) {
      logger.warn("No valid push tokens provided for bulk notification");
      return [];
    }

    logger.info(`Sending ${messages.length} push notifications`);

    // Chunk the notifications for batching
    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    // Send the chunks to the Expo push notification service
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        logger.error("Error sending chunk:", error);
      }
    }

    const successCount = tickets.filter((t) => t.status === "ok").length;
    logger.info(
      `Successfully sent ${successCount}/${tickets.length} notifications`
    );

    return tickets;
  } catch (error) {
    logger.error("Error in sendBulkPushNotifications:", error);
    return [];
  }
}
