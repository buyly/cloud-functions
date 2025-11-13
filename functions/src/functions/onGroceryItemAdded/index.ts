import {onDocumentCreated} from "firebase-functions/v2/firestore";
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

interface GroceryList {
  id: string;
  title: string;
  owner: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
}

interface GroceryListItem {
  id?: string;
  GroceryListId: string | null;
  count: number;
  createdAt: string;
  created_at: string;
  deletedAt: string | null;
  imgUrl: string;
  isBought: boolean;
  name: string;
  price: {
    amount: number;
    currency: string;
  };
  shop: string | null;
  updatedAt: string;
  updated_at: string;
  userId: string;
}

/**
 * Firestore trigger that runs when a new grocery item is added
 * Sends push notifications to all members of the grocery list
 */
export const onGroceryItemAdded = onDocumentCreated(
  "grocery-items/{itemId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("No data associated with the event");
      return;
    }

    const itemId = event.params.itemId;
    const itemData = snapshot.data() as GroceryListItem;

    // Skip if item doesn't have a grocery list ID
    if (!itemData.GroceryListId) {
      logger.info("Item has no GroceryListId, skipping notification");
      return;
    }

    const groceryListId = itemData.GroceryListId;

    logger.info(
      `New grocery item added: ${itemData.name} to list ${groceryListId}`
    );

    try {
      const db = admin.firestore();

      // Get the grocery list to find all members
      const groceryListRef = db.collection("grocery-lists").doc(groceryListId);
      const groceryListDoc = await groceryListRef.get();

      if (!groceryListDoc.exists) {
        logger.warn(`Grocery list not found: ${groceryListId}`);
        return;
      }

      const groceryListData = groceryListDoc.data() as GroceryList | undefined;
      const members = groceryListData?.members || [];
      const owner = groceryListData?.owner;
      const groceryListName = groceryListData?.title || "Grocery List";

      // Combine owner and members, remove duplicates
      const allMembers = Array.from(
        new Set([owner, ...members].filter(Boolean) as string[])
      );

      // Exclude the user who added the item
      const membersToNotify = allMembers.filter(
        (memberId) => memberId !== itemData.userId
      );

      if (membersToNotify.length === 0) {
        logger.info("No other members to notify");
        return;
      }

      // Get the user who added the item
      const addedByUserDoc = await db
        .collection("users")
        .doc(itemData.userId)
        .get();
      const addedByUserData = addedByUserDoc.data();
      const addedByUserName =
        addedByUserData?.displayName ||
        addedByUserData?.name ||
        addedByUserData?.email ||
        "Someone";

      // Prepare notification content
      const notificationTitle = "New Item Added";
      const notificationBody =
        `${addedByUserName} added "${itemData.name}" to ${groceryListName}`;

      logger.info(`Notifying ${membersToNotify.length} member(s)`);

      // Send notifications to each member
      for (const memberId of membersToNotify) {
        try {
          // Create notification document in Firestore
          const notificationData = {
            userId: memberId,
            type: "grocery_item_added",
            title: notificationTitle,
            body: notificationBody,
            data: {
              groceryListId,
              itemId,
              itemName: itemData.name,
              addedBy: itemData.userId,
              addedByUserName,
              groceryListName,
            },
            read: false,
            dismissed: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          await db.collection("notifications").add(notificationData);
          logger.info(`Created notification document for user ${memberId}`);

          // Get user's push tokens and send push notification
          const userDoc = await db.collection("users").doc(memberId).get();
          const userData = userDoc.data();
          const pushTokens = userData?.pushTokens as PushToken[] | undefined;

          if (pushTokens && pushTokens.length > 0) {
            const tokens = pushTokens.map((pt) => pt.token);

            await sendBulkPushNotifications({
              pushTokens: tokens,
              title: notificationTitle,
              body: notificationBody,
              data: {
                type: "grocery_item_added",
                groceryListId,
                itemId,
                itemName: itemData.name,
                addedBy: itemData.userId,
                addedByUserName,
              },
              channelId: "grocery-list-updates",
            });

            logger.info(
              `Sent push notification to ${tokens.length} device(s) ` +
                `for user ${memberId}`
            );
          } else {
            logger.info(
              `User ${memberId} has no push tokens, skipping push notification`
            );
          }
        } catch (memberError) {
          // Don't fail the entire function if one notification fails
          logger.error(
            `Error sending notification to member ${memberId}:`,
            memberError
          );
        }
      }

      logger.info(
        `Successfully processed notifications for new item: ${itemData.name}`
      );
    } catch (error) {
      logger.error("Error in onGroceryItemAdded:", error);
      // Don't throw - we don't want to retry this trigger
    }
  }
);
