/**
 * Script to set a user as admin by updating their custom claims
 *
 * Usage:
 * 1. Replace the UID with the target user's UID
 * 2. Place your service account key file in a secure location
 * 3. Update the SERVICE_ACCOUNT_PATH constant to point to your key file
 * 4. Run with: npx ts-node scripts/setUserAsAdmin.ts
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

// Set the UID of the user you want to make an admin
const userUid = "NHOvOYZp7LS9OtfBc1HFb2CI7Cr2"; // Replace with the actual UID

/**
 * Set admin role for the specified user
 * @return {Promise<void>} Promise that resolves when the operation completes
 */
async function setUserAsAdmin(): Promise<void> {
  try {
    // Set custom claims for the user
    await admin.auth().setCustomUserClaims(userUid, {role: "admin"});
    console.log(`Successfully set user ${userUid} as admin`);

    // Verify the claims were set correctly
    const userRecord = await admin.auth().getUser(userUid);
    console.log("User custom claims:", userRecord.customClaims);
  } catch (error) {
    console.error("Error setting admin role:", error);
  } finally {
    process.exit();
  }
}

setUserAsAdmin();
