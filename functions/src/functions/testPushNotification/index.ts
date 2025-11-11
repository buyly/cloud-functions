import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {Expo, ExpoPushMessage} from "expo-server-sdk";

interface TestPushNotificationRequest {
  pushTokens: string[]; // Array of Expo push tokens to test
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  richContent?: {
    image?: string;
  };
}

/**
 * Test push notification function using expo-server-sdk
 * This is a callable function that sends test notifications to multiple devices
 * and returns detailed information about tickets and receipts
 */
export const testPushNotification = onCall(
  {cors: true},
  async (request) => {
    const {
      pushTokens,
      title = "Test Notification",
      body = "This is a test notification from Buyly",
      data = {test: true},
      sound = "default",
      badge,
      channelId,
      priority,
    } = request.data as TestPushNotificationRequest;

    // Validate required fields
    if (!pushTokens || !Array.isArray(pushTokens) || pushTokens.length === 0) {
      logger.error("pushTokens array is required and must not be empty");
      throw new HttpsError(
        "invalid-argument",
        "pushTokens array is required and must not be empty"
      );
    }

    try {
      // Create a new Expo SDK client
      // Optionally use access token from environment variable
      const expo = new Expo({
        accessToken: process.env.EXPO_ACCESS_TOKEN,
        useFcmV1: true, // Use FCM v1 (default)
      });

      // Create the messages array
      const messages: ExpoPushMessage[] = [];

      for (const pushToken of pushTokens) {
        // Check that all push tokens are valid Expo push tokens
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
          ...(badge !== undefined && {badge}),
          ...(channelId && {channelId}),
          ...(priority && {priority}),
        });
      }

      if (messages.length === 0) {
        logger.error("No valid push tokens provided");
        throw new HttpsError(
          "invalid-argument",
          "No valid Expo push tokens provided"
        );
      }

      logger.info(`Sending ${messages.length} push notifications`);

      // Chunk the notifications for batching
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      // Send the chunks to the Expo push notification service
      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          logger.info("Ticket chunk received:", ticketChunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          logger.error("Error sending chunk:", error);
          throw error;
        }
      }

      // Collect receipt IDs from successful tickets
      const receiptIds = [];
      for (const ticket of tickets) {
        if (ticket.status === "ok") {
          receiptIds.push(ticket.id);
        }
      }

      logger.info(`Successfully sent ${receiptIds.length} notifications`);

      // Wait a bit for receipts to be ready (optional, for testing)
      // In production, you'd check receipts later
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Retrieve receipts
      let receipts = {};
      if (receiptIds.length > 0) {
        const receiptIdChunks =
          expo.chunkPushNotificationReceiptIds(receiptIds);

        for (const chunk of receiptIdChunks) {
          try {
            const receiptChunk =
              await expo.getPushNotificationReceiptsAsync(chunk);
            receipts = {...receipts, ...receiptChunk};

            // Log any errors in receipts
            for (const receiptId in receiptChunk) {
              if (
                Object.prototype.hasOwnProperty.call(receiptChunk, receiptId)
              ) {
                const receipt = receiptChunk[receiptId];
                if (receipt.status === "error") {
                  logger.error(
                    `Error in receipt ${receiptId}:`,
                    {
                      message: receipt.message,
                      details: receipt.details,
                    }
                  );
                }
              }
            }
          } catch (error) {
            logger.error("Error fetching receipts:", error);
          }
        }
      }

      return {
        success: true,
        message: `Test notifications sent to ${messages.length} device(s)`,
        summary: {
          totalTokens: pushTokens.length,
          validTokens: messages.length,
          ticketsSent: tickets.length,
          successfulTickets: receiptIds.length,
          receiptsRetrieved: Object.keys(receipts).length,
        },
        tickets,
        receipts,
      };
    } catch (error) {
      logger.error("Error in testPushNotification:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Error sending test push notification: ${(error as Error).message}`
      );
    }
  }
);
