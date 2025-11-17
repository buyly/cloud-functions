import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Trigger when a user account is deleted
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  logger.info(`User deleted: ${user.uid}`);

  try {
    const db = admin.firestore();

    // Delete user document
    await db.collection("users").doc(user.uid).delete();
    logger.info(`Deleted user document for ${user.uid}`);

    // Delete user's grocery items
    const groceryItemsSnapshot = await db
      .collection("grocery-items")
      .where("userId", "==", user.uid)
      .get();

    const batch = db.batch();
    groceryItemsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    if (!groceryItemsSnapshot.empty) {
      await batch.commit();
      logger.info(
        `Deleted ${groceryItemsSnapshot.size} grocery items
        for user ${user.uid}`
      );
    }

    // Delete user's shopping history
    const historySnapshot = await db
      .collection("history-items")
      .where("userId", "==", user.uid)
      .get();

    // Delete user's todos
    const todosSnapshot = await db
      .collection("todos")
      .where("userId", "==", user.uid)
      .get();

    const todoBatch = db.batch();
    todosSnapshot.docs.forEach((doc) => {
      todoBatch.delete(doc.ref);
    });

    if (!todosSnapshot.empty) {
      await todoBatch.commit();
      logger.info(
        `Deleted ${todosSnapshot.size} todos
         for user ${user.uid}`
      );
    }

    // Delete user's grocery lists
    const groceryListsSnapshot = await db
      .collection("grocery-lists")
      .where("userId", "==", user.uid)
      .get();

    const groceryListBatch = db.batch();
    groceryListsSnapshot.docs.forEach((doc) => {
      groceryListBatch.delete(doc.ref);
    });

    if (!groceryListsSnapshot.empty) {
      await groceryListBatch.commit();
      logger.info(
        `Deleted ${groceryListsSnapshot.size} grocery lists
         for user ${user.uid}`
      );
    }
    // set user to deleted collection
    await db.collection("deleted-users").doc(user.uid).set({
      email: user.email,
      displayName: user.displayName,
      createdAt: user.metadata.creationTime,
      lastLogin: user.metadata.lastSignInTime,
      deletedAt: new Date().toISOString(),
    });

    const historyBatch = db.batch();
    historySnapshot.docs.forEach((doc) => {
      historyBatch.delete(doc.ref);
    });

    if (!historySnapshot.empty) {
      await historyBatch.commit();
      logger.info(
        `Deleted ${historySnapshot.size} shopping history
         records for user ${user.uid}`
      );
    }

    // Delete user's recent search items
    const recentSearchItemsSnapshot = await db
      .collection("recent-search-items")
      .where("userId", "==", user.uid)
      .get();

    const recentSearchBatch = db.batch();
    recentSearchItemsSnapshot.docs.forEach((doc) => {
      recentSearchBatch.delete(doc.ref);
    });

    if (!recentSearchItemsSnapshot.empty) {
      await recentSearchBatch.commit();
      logger.info(
        `Deleted ${recentSearchItemsSnapshot.size} recent search items
         for user ${user.uid}`
      );
    }

    logger.info(`Successfully cleaned up all data for user ${user.uid}`);
  } catch (error) {
    logger.error("Error cleaning up user data:", error);
    throw error;
  }
});
