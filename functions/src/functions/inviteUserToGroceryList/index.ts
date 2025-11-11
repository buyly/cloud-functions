import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {sendBulkPushNotifications} from "../../helpers/sendPushNotification";

interface PushToken {
  createdAt: string;
  deviceId: string;
  lastUsed: string;
  platform: "ios" | "android" | string;
  token: string;
}

interface InviteUserToGroceryListRequest {
  email: string;
  groceryListId: string;
}

/**
 * Callable function to invite a user to a grocery list by email
 * Looks up the user by email and adds them to the grocery list members
 */
export const inviteUserToGroceryList = onCall(
  {cors: true},
  async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
      logger.error("Unauthenticated request to inviteUserToGroceryList");
      throw new HttpsError(
        "unauthenticated",
        "You must be authenticated to invite users to a grocery list"
      );
    }

    const {
      email,
      groceryListId,
    } = request.data as InviteUserToGroceryListRequest;

    // Validate required fields
    if (!email || typeof email !== "string") {
      logger.error("Invalid email provided");
      throw new HttpsError(
        "invalid-argument",
        "A valid email address is required"
      );
    }

    if (!groceryListId || typeof groceryListId !== "string") {
      logger.error("Invalid groceryListId provided");
      throw new HttpsError(
        "invalid-argument",
        "A valid grocery list ID is required"
      );
    }

    const invitingUserId = request.auth.uid;

    try {
      const db = admin.firestore();

      // Find the user by email
      logger.info(`Looking up user with email: ${email}`);
      const usersSnapshot = await db
        .collection("users")
        .where("email", "==", email.toLowerCase())
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        logger.warn(`No user found with email: ${email}`);
        throw new HttpsError(
          "not-found",
          "No user found with the provided email address"
        );
      }

      const invitedUserDoc = usersSnapshot.docs[0];
      const invitedUserId = invitedUserDoc.id;

      // Check if user is trying to invite themselves
      if (invitedUserId === invitingUserId) {
        logger.warn("User attempted to invite themselves");
        throw new HttpsError(
          "invalid-argument",
          "You cannot invite yourself to the grocery list"
        );
      }

      // Get the grocery list
      const groceryListRef = db.collection("grocery-lists").doc(groceryListId);
      const groceryListDoc = await groceryListRef.get();

      if (!groceryListDoc.exists) {
        logger.warn(`Grocery list not found: ${groceryListId}`);
        throw new HttpsError("not-found", "Grocery list not found");
      }

      const groceryListData = groceryListDoc.data();

      // Check if the inviting user has permission to invite others
      // (they should be a member or owner of the list)
      const members = groceryListData?.members || [];
      const owner = groceryListData?.owner;

      const isOwner = owner === invitingUserId;
      const isMember = members.includes(invitingUserId);

      if (!isOwner && !isMember) {
        logger.warn(
          `User ${invitingUserId} is not authorized to invite users ` +
            `to list ${groceryListId}`
        );
        throw new HttpsError(
          "permission-denied",
          "You do not have permission to invite users to this grocery list"
        );
      }

      // Check if the user is already a member
      if (members.includes(invitedUserId)) {
        logger.info(
          `User ${invitedUserId} is already a member of list ${groceryListId}`
        );
        throw new HttpsError(
          "already-exists",
          "This user is already a member of the grocery list"
        );
      }

      // Add the user to the grocery list members
      await groceryListRef.update({
        members: admin.firestore.FieldValue.arrayUnion(invitedUserId),
        updatedAt: new Date().toISOString(),
      });

      logger.info(
        `Successfully added user ${invitedUserId} (${email}) to grocery list ` +
          `${groceryListId}`
      );

      // Get user info for notification
      const invitedUserData = invitedUserDoc.data();
      const invitingUserDoc = await db
        .collection("users")
        .doc(invitingUserId)
        .get();
      const invitingUserData = invitingUserDoc.data();
      const invitingUserName = invitingUserData?.displayName ||
        invitingUserData?.name ||
        invitingUserData?.email ||
        "Someone";
      const groceryListName = groceryListData?.name || "a grocery list";

      // Create notification document in Firestore
      try {
        const notificationData = {
          userId: invitedUserId,
          type: "grocery_list_invite",
          title: "Added to Grocery List",
          body: `${invitingUserName} added you to "${groceryListName}"`,
          data: {
            groceryListId,
            invitingUserId,
            invitingUserName,
            groceryListName,
          },
          read: false,
          dismissed: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("notifications").add(notificationData);

        logger.info(
          `Created notification document for user ${invitedUserId}`
        );
      } catch (notificationError) {
        logger.error(
          "Error creating notification document:",
          notificationError
        );
      }

      // Send push notification to the invited user
      try {
        const pushTokens =
          invitedUserData?.pushTokens as PushToken[] | undefined;

        if (pushTokens && pushTokens.length > 0) {
          // Extract the token strings from the pushTokens array
          const tokens = pushTokens.map((pt) => pt.token);

          // Send push notifications to all user's devices
          await sendBulkPushNotifications({
            pushTokens: tokens,
            title: "Added to Grocery List",
            body: `${invitingUserName} added you to "${groceryListName}"`,
            data: {
              type: "grocery_list_invite",
              groceryListId,
              invitingUserId,
              invitingUserName,
            },
            channelId: "grocery-list-invites",
          });

          logger.info(
            "Sent grocery list invite notification to " +
              `${tokens.length} device(s) for user ${invitedUserId}`
          );
        } else {
          logger.info(
            `Skipping push notification; user ${invitedUserId} has no ` +
              "push tokens"
          );
        }
      } catch (notificationError) {
        // Don't fail the invite if notification fails
        logger.error(
          "Error sending push notification for grocery list invite:",
          notificationError
        );
      }

      return {
        success: true,
        message: `Successfully invited ${email} to the grocery list`,
        invitedUserId,
        groceryListId,
      };
    } catch (error) {
      logger.error("Error in inviteUserToGroceryList:", error);

      // Re-throw HttpsError instances
      if (error instanceof HttpsError) {
        throw error;
      }

      // Handle other errors
      throw new HttpsError(
        "internal",
        `Error inviting user to grocery list: ${(error as Error).message}`
      );
    }
  }
);
