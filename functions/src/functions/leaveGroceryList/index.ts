import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

interface LeaveGroceryListRequest {
  groceryListId: string;
}

/**
 * Callable function to allow a member to remove themselves
 * from a grocery list
 * Removes the user from the members array and optionally
 * cleans up their grocery items
 */
export const leaveGroceryList = onCall({cors: true}, async (request) => {
  // Check if user is authenticated
  if (!request.auth) {
    logger.error("Unauthenticated request to leaveGroceryList");
    throw new HttpsError(
      "unauthenticated",
      "You must be authenticated to leave a grocery list"
    );
  }

  const {groceryListId} = request.data as LeaveGroceryListRequest;

  // Validate required fields
  if (!groceryListId || typeof groceryListId !== "string") {
    logger.error("Invalid groceryListId provided");
    throw new HttpsError(
      "invalid-argument",
      "A valid grocery list ID is required"
    );
  }

  const userId = request.auth.uid;

  try {
    const db = admin.firestore();

    // Get the grocery list
    const groceryListRef = db.collection("grocery-lists").doc(groceryListId);
    const groceryListDoc = await groceryListRef.get();

    if (!groceryListDoc.exists) {
      logger.warn(`Grocery list not found: ${groceryListId}`);
      throw new HttpsError("not-found", "Grocery list not found");
    }

    const groceryListData = groceryListDoc.data();
    const members = groceryListData?.members || [];
    const owner = groceryListData?.owner;

    // Check if user is the owner
    if (owner === userId) {
      logger.warn(`Owner ${userId} attempted to leave their own list`);
      throw new HttpsError(
        "permission-denied",
        "The owner cannot leave the grocery list. " +
          "You must transfer ownership or delete the list."
      );
    }

    // Check if user is a member
    if (!members.includes(userId)) {
      logger.warn(`User ${userId} is not a member of list ${groceryListId}`);
      throw new HttpsError(
        "permission-denied",
        "You are not a member of this grocery list"
      );
    }

    // Remove the user from the members array
    await groceryListRef.update({
      members: admin.firestore.FieldValue.arrayRemove(userId),
      updatedAt: new Date().toISOString(),
    });

    logger.info(
      `Successfully removed user ${userId} from grocery list ${groceryListId}`
    );

    // Clean up user's grocery items for this list
    // convert them to personal items
    try {
      const userItemsSnapshot = await db
        .collection("grocery-items")
        .where("GroceryListId", "==", groceryListId)
        .where("userId", "==", userId)
        .get();

      const batch = db.batch();
      userItemsSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          GroceryListId: null,
          updatedAt: new Date().toISOString(),
        });
      });

      if (userItemsSnapshot.size > 0) {
        await batch.commit();
        logger.info(
          `Converted ${userItemsSnapshot.size} items ` +
            `to personal items for user ${userId}`
        );
      }
    } catch (cleanupError) {
      logger.error("Error cleaning up user's grocery items:", cleanupError);
      // Don't fail the leave operation if cleanup fails
    }

    // Get user info for notification
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const userName =
      userData?.displayName || userData?.name || userData?.email || "Someone";
    const groceryListName = groceryListData?.title || "a grocery list";

    // Create notification document for the owner
    try {
      const notificationData = {
        userId: owner,
        type: "member_left_grocery_list",
        title: "Member Left List",
        body: `${userName} left ${groceryListName}`,
        data: {
          groceryListId,
          leavingUserId: userId,
          leavingUserName: userName,
          groceryListName,
        },
        read: false,
        dismissed: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("notifications").add(notificationData);
      logger.info(`Created notification document for owner ${owner}`);
    } catch (notificationError) {
      logger.error("Error creating notification document:", notificationError);
    }

    return {
      success: true,
      message: "Successfully left the grocery list",
      groceryListId,
    };
  } catch (error) {
    logger.error("Error in leaveGroceryList:", error);

    // Re-throw HttpsError instances
    if (error instanceof HttpsError) {
      throw error;
    }

    // Handle other errors
    throw new HttpsError(
      "internal",
      `Error leaving grocery list: ${(error as Error).message}`
    );
  }
});
