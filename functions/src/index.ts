/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onSchedule, ScheduledEvent} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {Resend} from "resend";
import {onRequest} from "firebase-functions/v2/https";
import * as fs from "fs";
import * as path from "path";
import {createClient} from "@supabase/supabase-js";
import {sendWelcomeEmail} from "./helpers/sendWelcomeEmail";
import {sendBudgetAlertEmail} from "./helpers/sendBudgetAlertEmail";
import * as functions from "firebase-functions/v1";
import {onDocumentCreated} from "firebase-functions/v2/firestore";

admin.initializeApp();

export const sendGroceryItemsCount = onSchedule(
  "0 10 * * *",
  // every day at 10am
  // every 1 minute
  // "*/1 * * * *",
  async (event: ScheduledEvent) => {
    logger.info("Starting grocery items count report...", event);

    if (!process.env.RESEND_API_KEY) {
      logger.error("RESEND_API_KEY environment variable is not set!");
      throw new Error("RESEND_API_KEY environment variable is not set!");
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      logger.error(
        "SUPABASE_URL or SUPABASE_ANON_KEY environment variable is not set!"
      );
      throw new Error(
        "SUPABASE_URL or SUPABASE_ANON_KEY environment variable is not set!"
      );
    }

    try {
      logger.info("Connecting to Firestore...");
      const db = admin.firestore();

      logger.info("Fetching counts...");
      const groceryItemsSnapshot = await db
        .collection("grocery-items")
        .count()
        .get();
      const groceryListsSnapshot = await db
        .collection("grocery-lists")
        .count()
        .get();
      const historyItemsSnapshot = await db
        .collection("history-items")
        .count()
        .get();
      const todosSnapshot = await db.collection("todos").count().get();
      const usersSnapshot = await db.collection("users").count().get();

      if (!groceryItemsSnapshot.data()) {
        logger.error(
          "No data returned from Firestore count query for grocery items"
        );
        throw new Error(
          "No data returned from Firestore count query for grocery items"
        );
      }

      if (!groceryListsSnapshot.data()) {
        logger.error(
          "No data returned from Firestore count query for grocery lists"
        );
        throw new Error(
          "No data returned from Firestore count query for grocery lists"
        );
      }

      if (!historyItemsSnapshot.data()) {
        logger.error(
          "No data returned from Firestore count query for history items"
        );
        throw new Error(
          "No data returned from Firestore count query for history items"
        );
      }

      if (!todosSnapshot.data()) {
        logger.error("No data returned from Firestore count query for todos");
        throw new Error(
          "No data returned from Firestore count query for todos"
        );
      }

      if (!usersSnapshot.data()) {
        logger.error("No data returned from Firestore count query for users");
        throw new Error(
          "No data returned from Firestore count query for users"
        );
      }

      // get the count for the store products from the supabase
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      const {count, error} = await supabase
        .from("store_items")
        .select("*", {count: "exact", head: true});

      if (error) throw error;

      const storeItemsCount = count ?? 0;
      logger.info(
        `Retrieved counts from Supabase: store items: ${storeItemsCount}`
      );

      // get the counts from firestore
      const groceryItemsCount = groceryItemsSnapshot.data().count;
      const groceryListsCount = groceryListsSnapshot.data().count;
      const historyItemsCount = historyItemsSnapshot.data().count;
      const todosCount = todosSnapshot.data().count;
      const usersCount = usersSnapshot.data().count;

      logger.info(`Retrieved counts from Firestore:
        grocery items: ${groceryItemsCount},
        grocery lists: ${groceryListsCount},
        history items: ${historyItemsCount},
        todos: ${todosCount},
        users: ${usersCount}`);

      logger.info("Attempting to send email...");

      // Read the HTML template
      const templatePath = path.join(
        process.cwd(),
        "src",
        "email-templates",
        "daily-report",
        "index.html"
      );

      logger.info(`Attempting to read template from: ${templatePath}`);
      let htmlContent;

      try {
        htmlContent = fs.readFileSync(templatePath, "utf8");
      } catch (error) {
        logger.error(`Failed to read template file: ${error}`);
        throw error;
      }

      // Replace placeholders with actual values
      htmlContent = htmlContent
        .replace(/__GROCERY_ITEMS_COUNT__/g, groceryItemsCount.toString())
        .replace(/__GROCERY_LISTS_COUNT__/g, groceryListsCount.toString())
        .replace(/__HISTORY_ITEMS_COUNT__/g, historyItemsCount.toString())
        .replace(/__STORE_ITEMS_COUNT__/g, storeItemsCount.toString())
        .replace(/__TODOS_COUNT__/g, todosCount.toString())
        .replace(/__USERS_COUNT__/g, usersCount.toString());

      const data = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Buyly <noreply@buyly.co.za>",
        to: ["info@buyly.co.za"],
        subject: "Daily Database Counts Report",
        html: htmlContent,
      });

      logger.info("Email sent successfully:", data);
    } catch (error) {
      logger.error("Error in sendGroceryItemsCount:", error);
      throw error;
    }
  }
);

export const sendGroceryItemsCountRequest = onRequest(
  async (request, response) => {
    logger.info("Starting grocery items count report...");

    if (!process.env.RESEND_API_KEY) {
      logger.error("RESEND_API_KEY environment variable is not set!");
      throw new Error("RESEND_API_KEY environment variable is not set!");
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      logger.error(
        "SUPABASE_URL or SUPABASE_ANON_KEY environment variable is not set!"
      );
      throw new Error(
        "SUPABASE_URL or SUPABASE_ANON_KEY environment variable is not set!"
      );
    }

    try {
      logger.info("Connecting to Firestore...");
      const db = admin.firestore();

      logger.info("Fetching counts...");
      const groceryItemsSnapshot = await db
        .collection("grocery-items")
        .count()
        .get();
      const groceryListsSnapshot = await db
        .collection("grocery-lists")
        .count()
        .get();
      const historyItemsSnapshot = await db
        .collection("history-items")
        .count()
        .get();
      const todosSnapshot = await db.collection("todos").count().get();
      const usersSnapshot = await db.collection("users").count().get();

      if (!groceryItemsSnapshot.data()) {
        logger.error(
          "No data returned from Firestore count query for grocery items"
        );
        throw new Error(
          "No data returned from Firestore count query for grocery items"
        );
      }

      if (!groceryListsSnapshot.data()) {
        logger.error(
          "No data returned from Firestore count query for grocery lists"
        );
        throw new Error(
          "No data returned from Firestore count query for grocery lists"
        );
      }

      if (!historyItemsSnapshot.data()) {
        logger.error(
          "No data returned from Firestore count query for history items"
        );
        throw new Error(
          "No data returned from Firestore count query for history items"
        );
      }

      if (!todosSnapshot.data()) {
        logger.error("No data returned from Firestore count query for todos");
        throw new Error(
          "No data returned from Firestore count query for todos"
        );
      }

      if (!usersSnapshot.data()) {
        logger.error("No data returned from Firestore count query for users");
        throw new Error(
          "No data returned from Firestore count query for users"
        );
      }

      // get the count for the store products from the supabase
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      const {count, error} = await supabase
        .from("store_items")
        .select("*", {count: "exact", head: true});

      if (error) throw error;

      const storeItemsCount = count ?? 0;
      logger.info(
        `Retrieved counts from Supabase: store items: ${storeItemsCount}`
      );

      // get the counts from firestore
      const groceryItemsCount = groceryItemsSnapshot.data().count;
      const groceryListsCount = groceryListsSnapshot.data().count;
      const historyItemsCount = historyItemsSnapshot.data().count;
      const todosCount = todosSnapshot.data().count;
      const usersCount = usersSnapshot.data().count;

      logger.info(`Retrieved counts from Firestore:
        grocery items: ${groceryItemsCount},
        grocery lists: ${groceryListsCount},
        history items: ${historyItemsCount},
        todos: ${todosCount},
        users: ${usersCount}`);

      logger.info("Attempting to send email...");

      // Read the HTML template
      const templatePath = path.join(
        process.cwd(),
        "src",
        "email-templates",
        "daily-report",
        "index.html"
      );

      logger.info(`Attempting to read template from: ${templatePath}`);
      let htmlContent;

      try {
        htmlContent = fs.readFileSync(templatePath, "utf8");
      } catch (error) {
        logger.error(`Failed to read template file: ${error}`);
        throw error;
      }

      // Replace placeholders with actual values
      htmlContent = htmlContent
        .replace(/__GROCERY_ITEMS_COUNT__/g, groceryItemsCount.toString())
        .replace(/__GROCERY_LISTS_COUNT__/g, groceryListsCount.toString())
        .replace(/__HISTORY_ITEMS_COUNT__/g, historyItemsCount.toString())
        .replace(/__STORE_ITEMS_COUNT__/g, storeItemsCount.toString())
        .replace(/__TODOS_COUNT__/g, todosCount.toString())
        .replace(/__USERS_COUNT__/g, usersCount.toString());

      const data = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Buyly App <buyly@buyly.co.za>",
        to: ["info@buyly.co.za"],
        subject: "Daily Database Counts Report",
        html: htmlContent,
      });

      logger.info("Email sent successfully:", data);

      response.status(200).send("Email sent successfully");
    } catch (error) {
      logger.error("Error in sendGroceryItemsCount:", error);
      throw error;
    }
  }
);

// Responds with "Hello Earth and Humans"
exports.hello = onRequest((request, response) => {
  response.send(`Hello ${process.env.PLANET} and ${process.env.AUDIENCE}!`);
});

// Send welcome email
exports.sendWelcomeEmail = functions.auth.user().onCreate(async (user) => {
  const {email, displayName} = user;
  logger.info("Email sent successfully:", user);

  if (!email) {
    logger.error("User email not found");
    return {success: false, error: "User email or display name not found"};
  }

  try {
    const data = await sendWelcomeEmail(email, displayName ?? "there");
    logger.info("Email sent successfully:", data);
    return {success: true};
  } catch (error) {
    console.error("Error sending email:", error);
    return {success: false, error: (error as Error).message};
  }
});

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

// test function
export const getUserIACredits = onRequest((request, response) => {
  const now = new Date();
  const todayDate = now.toISOString().slice(0, 10); // YYYY-MM-DD format

  response.json({
    ai: {
      credits: 1000, // Starting credit balance
      tier: "free", // Default tier
      dailyUsage: 0, // No usage yet
      lastDailyReset: todayDate, // today's date (YYYY-MM-DD)
      lastMonthlyReset: todayDate, // today's date

      lastCreditsAdded: {
        amount: 1000,
        date: now.toISOString(), // exact timestamp
        reason: "test-function", // distinguish from other types
      },

      totalRequests: 0, // No requests yet
      tokensUsed: 0, // No tokens consumed yet
      estimatedUsdSpent: 0, // No cost yet
      lastUsageAt: null, // Not used yet

      modelsUsed: {}, // Will be populated over time
    },
    message: "This is a test function that returns AI data with 1000 credits",
  });
});

export const onCreateUser = functions.auth.user().onCreate(async (user) => {
  const userRef = admin.firestore().doc(`users/${user.uid}`);
  const now = new Date();
  const todayDate = now.toISOString().slice(0, 10); // YYYY-MM-DD format

  await userRef.set(
    {
      ai: {
        credits: 1000, // Starting credit balance
        tier: "free", // Default tier
        dailyUsage: 0, // No usage yet
        lastDailyReset: todayDate, // today's date (YYYY-MM-DD)
        lastMonthlyReset: todayDate, // today's date

        lastCreditsAdded: {
          amount: 1000,
          date: now.toISOString(), // exact timestamp
          reason: "signup-reward", // distinguish from monthly refills
        },

        totalRequests: 0, // No requests yet
        tokensUsed: 0, // No tokens consumed yet
        estimatedUsdSpent: 0, // No cost yet
        lastUsageAt: null, // Not used yet

        modelsUsed: {}, // Will be populated over time
      },
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {merge: true}
  );
});

export const addCreditsToUser = onRequest(async (request, response) => {
  // Handle preflight requests
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }

  try {
    // Only allow POST requests
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed"});
      return;
    }

    const {id, credits, reason} = request.body;

    // Validate input parameters
    if (!id || typeof id !== "string") {
      response.status(400).json({error: "Valid user ID is required"});
      return;
    }

    if (!credits || typeof credits !== "number" || credits <= 0) {
      response.status(400).json({
        error: "Valid positive credit amount is required",
      });
      return;
    }

    if (!reason || typeof reason !== "string") {
      response.status(400).json({error: "Valid reason is required"});
      return;
    }

    // Get user document
    const userRef = admin.firestore().doc(`users/${id}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      response.status(404).json({error: "User not found"});
      return;
    }

    const userData = userDoc.data();
    const currentCredits = userData?.ai?.credits || 0;
    const now = new Date();

    // Update user's AI credits
    await userRef.update({
      "ai.credits": currentCredits + credits,
      "ai.lastCreditsAdded": {
        amount: credits,
        date: now.toISOString(),
        reason: reason,
      },
      "updated_at": now.toISOString(),
    });

    logger.info(`Added ${credits} credits to user ${id} for reason: ${reason}`);

    response.status(200).json({
      success: true,
      message: `Successfully added ${credits} credits to user ${id}`,
      newBalance: currentCredits + credits,
      creditsAdded: credits,
      reason: reason,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error("Error adding credits to user:", error);
    response.status(500).json({
      error: "Internal server error",
      details: (error as Error).message,
    });
  }
});

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
