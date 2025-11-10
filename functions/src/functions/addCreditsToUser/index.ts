import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

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
