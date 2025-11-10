import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {sendBudgetAlertEmail} from "../../helpers/sendBudgetAlertEmail";

// Budget Alert Function - Triggered when a history item is created
export const checkBudgetAlert = onDocumentCreated(
  "history-items/{documentId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.error("No data associated with the event");
      return;
    }

    const historyData = snapshot.data();
    const userId = historyData.userId;

    if (!userId) {
      logger.error("No userId found in history item");
      return;
    }

    try {
      logger.info(`Processing budget alert check for user: ${userId}`);

      const db = admin.firestore();

      // Get user data to check budget settings
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        logger.error(`User document not found for userId: ${userId}`);
        return;
      }

      const userData = userDoc.data();

      // Check if user has budget set and alerts enabled
      // TODO: !userData?.is_budget_set || !userData?.is_budget_alert_set ||
      if (!userData?.budget) {
        logger.info(`User ${userId} does not have budget alerts enabled`);
        return;
      }

      const monthlyBudget = userData.budget;

      // Get user's auth record for email and name
      const userRecord = await admin.auth().getUser(userId);
      if (!userRecord.email) {
        logger.error(`No email found for user: ${userId}`);
        return;
      }

      // Calculate current month spending
      const currentDate = new Date();
      const startOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const endOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      // Query history items for current month
      const historyQuery = await db
        .collection("history-items")
        .where("userId", "==", userId)
        .where("date", ">=", startOfMonth.toISOString())
        .where("date", "<=", endOfMonth.toISOString())
        .get();

      // Calculate total spent this month
      let totalSpent = 0;
      historyQuery.docs.forEach((doc) => {
        const item = doc.data();
        totalSpent += item.totalAmount || 0;
      });

      const percentageSpent = (totalSpent / monthlyBudget) * 100;

      logger.info(
        `User ${userId} has spent ${percentageSpent.toFixed(2)}% ` +
          "of their monthly budget"
      );

      // Check if user has crossed the 50% threshold
      if (percentageSpent >= 50) {
        // Check if we've already sent an alert for this month
        const alertDoc = await db
          .collection("budget-alerts")
          .doc(
            `${userId}_${currentDate.getFullYear()}_` +
              `${currentDate.getMonth()}`
          )
          .get();

        if (alertDoc.exists) {
          logger.info(
            `Budget alert already sent for user ${userId} this month`
          );
          return;
        }

        // Send the budget alert email
        const budgetAlertData = {
          userName: userRecord.displayName || "there",
          monthlyBudget: monthlyBudget,
          amountSpent: totalSpent,
          percentageSpent: percentageSpent,
        };

        await sendBudgetAlertEmail(userRecord.email, budgetAlertData);

        // Record that we sent the alert to avoid duplicates
        await db
          .collection("budget-alerts")
          .doc(
            `${userId}_${currentDate.getFullYear()}_` +
              `${currentDate.getMonth()}`
          )
          .set({
            userId: userId,
            email: userRecord.email,
            monthlyBudget: monthlyBudget,
            amountSpent: totalSpent,
            percentageSpent: percentageSpent,
            sentAt: new Date().toISOString(),
            month: currentDate.getMonth(),
            year: currentDate.getFullYear(),
          });

        logger.info(
          `Budget alert sent to user ${userId} (${userRecord.email})`
        );
      }
    } catch (error) {
      logger.error("Error in checkBudgetAlert:", error);
      throw error;
    }
  }
);
