import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

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
