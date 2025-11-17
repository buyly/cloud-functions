/**
 * Script to revoke admin privileges from a user by updating their custom claims
 *
 * Usage:
 * 1. Replace the UID with the target user's UID
 * 2. Place your service account key file in a secure location
 * 3. Update the SERVICE_ACCOUNT_PATH constant to point to your key file
 * 4. Run with: npx ts-node scripts/revokeUserAdmin.ts
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

// Set the UID of the user you want to revoke admin privileges from
const userUid = "JrnowkxTfLV1e6uaZ683WNdbl6I2"; // Replace with the actual UID

/**
 * Revoke admin role from the specified user
 * @return {Promise<void>} Promise that resolves when the operation completes
 */
async function revokeUserAdmin(): Promise<void> {
  try {
    // First, get the current custom claims
    const userRecord = await admin.auth().getUser(userUid);
    console.log("Current user custom claims:", userRecord.customClaims);

    // Create a new claims object without the admin role
    const currentClaims = userRecord.customClaims || {};
    const newClaims = {...currentClaims};

    // Remove the admin role
    if (newClaims.role === "admin") {
      delete newClaims.role;
    } else {
      console.log(`User ${userUid} does not have admin role to revoke`);
    }

    // Set the updated custom claims
    await admin.auth().setCustomUserClaims(userUid, newClaims);
    console.log(`Successfully revoked admin privileges for user ${userUid}`);

    // Verify the claims were updated correctly
    const updatedUserRecord = await admin.auth().getUser(userUid);
    console.log("Updated user custom claims:", updatedUserRecord.customClaims);
  } catch (error) {
    console.error("Error revoking admin role:", error);
  } finally {
    process.exit();
  }
}

revokeUserAdmin();
