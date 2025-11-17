import {onRequest} from "firebase-functions/v2/https";

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
