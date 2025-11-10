/**
 * Script to load credits for a user by updating their AI credits
 *
 * Usage:
 * 1. Replace the USER_ID with the target user's ID
 * 2. Set the CREDITS_AMOUNT to the number of credits to add
 * 3. Set the REASON for adding credits
 * 4. Place your service account key file in a secure location
 * 5. Update the SERVICE_ACCOUNT_PATH constant to point to your key file
 * 6. Run with: npx ts-node scripts/loadUserCredits.ts
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Path to your service account key file (relative to where you run the script)
// IMPORTANT: Add this file to .gitignore to avoid leaking credentials
const SERVICE_ACCOUNT_PATH = "../service-account-key.json";

// Configuration - Update these values before running the script
const USER_ID = "kYPofxdIVOTzcwfERgnIG1gcWHX2"; // Replace with actual user ID
const CREDITS_AMOUNT = 1000; // Replace with number of credits to add
const REASON = "user bonus"; // Replace with reason for adding credits

// Function to check if file exists
/**
 * Check if a file exists at the given path
 * @param {string} filePath - Path to check
 * @return {boolean} Whether the file exists
 */
function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // Resolve the path relative to the current script
    const serviceAccountPath = path.resolve(__dirname, SERVICE_ACCOUNT_PATH);

    if (!fileExists(serviceAccountPath)) {
      throw new Error(
        `Service account file not found at: ${serviceAccountPath}`
      );
    }

    // Read and parse the service account key file
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    process.exit(1);
  }
}

/**
 * Load credits for the specified user
 * @return {Promise<void>} Promise that resolves when the operation completes
 */
async function loadUserCredits(): Promise<void> {
  try {
    // Validate input parameters
    if (!USER_ID || typeof USER_ID !== "string") {
      throw new Error(
        "Valid user ID is required. Please update USER_ID in the script."
      );
    }

    if (
      !CREDITS_AMOUNT ||
      typeof CREDITS_AMOUNT !== "number" ||
      CREDITS_AMOUNT <= 0
    ) {
      throw new Error(
        "Valid positive credit amount is required. " +
        "Please update CREDITS_AMOUNT in the script."
      );
    }

    if (!REASON || typeof REASON !== "string") {
      throw new Error(
        "Valid reason is required. Please update REASON in the script."
      );
    }

    console.log(
      `Loading ${CREDITS_AMOUNT} credits for user ${USER_ID}...`
    );

    // Get user document
    const userRef = admin.firestore().doc(`users/${USER_ID}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`User with ID ${USER_ID} not found`);
    }

    const userData = userDoc.data();
    const currentCredits = userData?.ai?.credits || 0;
    const now = new Date();

    console.log(`Current credits: ${currentCredits}`);
    console.log(`Adding credits: ${CREDITS_AMOUNT}`);
    console.log(
      `New balance will be: ${currentCredits + CREDITS_AMOUNT}`
    );

    // Update user's AI credits
    await userRef.update({
      "ai.credits": currentCredits + CREDITS_AMOUNT,
      "ai.lastCreditsAdded": {
        amount: CREDITS_AMOUNT,
        date: now.toISOString(),
        reason: REASON,
      },
      "updated_at": now.toISOString(),
    });

    console.log(
      `Successfully added ${CREDITS_AMOUNT} credits to user ${USER_ID}`
    );
    console.log(`New balance: ${currentCredits + CREDITS_AMOUNT}`);
    console.log(`Reason: ${REASON}`);
    console.log(`Timestamp: ${now.toISOString()}`);

    // Verify the update by fetching the updated document
    const updatedUserDoc = await userRef.get();
    const updatedUserData = updatedUserDoc.data();
    const updatedCredits = updatedUserData?.ai?.credits || 0;

    console.log(
      `Verification - Current credits in database: ${updatedCredits}`
    );
  } catch (error) {
    console.error("Error loading user credits:", error);
    throw error;
  } finally {
    process.exit();
  }
}

// Run the script
loadUserCredits();
