import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {sendBudgetAlertEmail} from "../../helpers/sendBudgetAlertEmail";

// Test function for budget alerts (manual testing)
export const testBudgetAlert = onRequest(async (request, response) => {
  try {
    const {userId} = request.body;

    if (!userId) {
      response.status(400).json({error: "userId is required"});
      return;
    }

    logger.info(`Testing budget alert for user: ${userId}`);

    const db = admin.firestore();

    // Get user data
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      response.status(404).json({error: "User not found"});
      return;
    }

    const userData = userDoc.data();

    // Check if user has budget set
    if (!userData?.is_budget_set || !userData?.budget) {
      response.status(400).json({
        error: "User does not have budget set",
        userData: {
          is_budget_set: userData?.is_budget_set,
          is_budget_alert_set: userData?.is_budget_alert_set,
          budget: userData?.budget,
        },
      });
      return;
    }

    // Get user's auth record
    const userRecord = await admin.auth().getUser(userId);
    if (!userRecord.email) {
      response.status(400).json({error: "User email not found"});
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

    const historyQuery = await db
      .collection("history-items")
      .where("userId", "==", userId)
      .where("date", ">=", startOfMonth.toISOString())
      .where("date", "<=", endOfMonth.toISOString())
      .get();

    let totalSpent = 0;
    historyQuery.docs.forEach((doc) => {
      const item = doc.data();
      totalSpent += item.totalAmount || 0;
    });

    const percentageSpent = (totalSpent / userData.budget) * 100;

    // Send test alert regardless of threshold
    const budgetAlertData = {
      userName: userRecord.displayName || "there",
      monthlyBudget: userData.budget,
      amountSpent: totalSpent,
      percentageSpent: percentageSpent,
    };

    await sendBudgetAlertEmail(userRecord.email, budgetAlertData);

    response.status(200).json({
      success: true,
      message: "Test budget alert sent successfully",
      data: {
        userId: userId,
        email: userRecord.email,
        monthlyBudget: userData.budget,
        totalSpent: totalSpent,
        percentageSpent: percentageSpent.toFixed(2),
        sentAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error in testBudgetAlert:", error);
    response.status(500).json({
      error: "Internal server error",
      details: (error as Error).message,
    });
  }
});
