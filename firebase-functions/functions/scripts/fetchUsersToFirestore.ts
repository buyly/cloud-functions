import * as admin from "firebase-admin";
import * as path from "path";
import * as dotenv from "dotenv";
import * as fs from "fs";

// Load environment variables
dotenv.config();

// Path to your service account key file (relative to where you run the script)
// IMPORTANT: Add this file to .gitignore to avoid leaking credentials
const SERVICE_ACCOUNT_PATH = "../service-account-key.json";
const serviceAccountPath = path.join(__dirname, SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

// Get Firestore with ignoreUndefinedProperties option
const db = admin.firestore();
db.settings({ignoreUndefinedProperties: true});

interface UserRecord {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  disabled: boolean;
  metadata: {
    creationTime: string;
    lastSignInTime?: string;
    lastRefreshTime?: string | null;
  };
  providerData: Array<{
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    providerId: string;
    phoneNumber?: string;
  }>;
  customClaims?: { [key: string]: unknown };
}

/**
 * Fetch all users from Firebase Auth and save them to Firestore collection
 * @return {Promise<Object>} Result object with user statistics
 */
async function fetchAllUsersAndSaveToFirestore() {
  try {
    console.log(
      "Starting to fetch all authenticated users from Firebase Auth..."
    );

    const db = admin.firestore();
    const auth = admin.auth();
    const totalUsersCollection = db.collection("totalUsers");

    let allUsers: UserRecord[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
      console.log(`Fetching page ${pageCount + 1}...`);

      const listUsersResult = await auth.listUsers(
        1000,
        nextPageToken
      );

      const users = listUsersResult.users.map((user) => ({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        disabled: user.disabled,
        metadata: {
          creationTime: user.metadata.creationTime || "",
          lastSignInTime: user.metadata.lastSignInTime,
          lastRefreshTime: user.metadata.lastRefreshTime,
        },
        providerData: user.providerData.map((provider) => ({
          uid: provider.uid,
          email: provider.email,
          displayName: provider.displayName,
          photoURL: provider.photoURL,
          providerId: provider.providerId,
          phoneNumber: provider.phoneNumber,
        })),
        customClaims: user.customClaims,
      }));

      allUsers = allUsers.concat(users);
      nextPageToken = listUsersResult.pageToken;
      pageCount++;

      console.log(
        `Fetched ${users.length} users from page ${pageCount}. ` +
        `Total so far: ${allUsers.length}`
      );
    } while (nextPageToken);

    console.log(`\nTotal users fetched: ${allUsers.length}`);
    console.log(
      "Starting to save users to Firestore totalUsers collection..."
    );

    const batch = db.batch();
    let batchCount = 0;
    const batchSize = 500;

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      const userDocRef = totalUsersCollection.doc(user.uid);

      batch.set(userDocRef, {
        ...user,
        exportedAt: admin.firestore.FieldValue.serverTimestamp(),
        exportedDate: new Date().toISOString(),
      });

      batchCount++;

      if (batchCount === batchSize || i === allUsers.length - 1) {
        console.log(
          `Committing batch ${Math.ceil((i + 1) / batchSize)} ` +
          `with ${batchCount} users...`
        );
        await batch.commit();

        if (i < allUsers.length - 1) {
          const newBatch = db.batch();
          Object.setPrototypeOf(
            batch,
            Object.getPrototypeOf(newBatch)
          );
          Object.assign(batch, newBatch);
        }

        batchCount = 0;
      }
    }

    console.log(
      "\n✅ Successfully saved " + allUsers.length + " users " +
      "to the totalUsers collection in Firestore!"
    );

    const summary = {
      totalUsers: allUsers.length,
      verifiedEmails: allUsers.filter((u) => u.emailVerified).length,
      usersWithDisplayName: allUsers.filter(
        (u) => u.displayName
      ).length,
      disabledUsers: allUsers.filter((u) => u.disabled).length,
      usersWithPhoneNumber: allUsers.filter(
        (u) => u.phoneNumber
      ).length,
    };

    console.log("\n📊 Summary:");
    console.log(`- Total users: ${summary.totalUsers}`);
    console.log(`- Verified emails: ${summary.verifiedEmails}`);
    console.log(
      `- Users with display name: ${summary.usersWithDisplayName}`
    );
    console.log(`- Disabled users: ${summary.disabledUsers}`);
    console.log(
      `- Users with phone number: ${summary.usersWithPhoneNumber}`
    );

    return {
      success: true,
      totalUsers: allUsers.length,
      summary,
    };
  } catch (error) {
    console.error(
      "❌ Error fetching users or saving to Firestore:",
      error
    );
    throw error;
  }
}


/**
 * Fetch all users from Firebase Auth and save them to JSON file
 * @return {Promise<Object>} Result object with user statistics and output path
 */
async function fetchAllUsersAndSaveToJson() {
  try {
    console.log(
      "Starting to fetch all authenticated users from Firebase Auth..."
    );

    const auth = admin.auth();

    let allUsers: UserRecord[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
      console.log(`Fetching page ${pageCount + 1}...`);

      const listUsersResult = await auth.listUsers(
        1000,
        nextPageToken
      );

      const users = listUsersResult.users.map((user) => ({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        disabled: user.disabled,
        metadata: {
          creationTime: user.metadata.creationTime || "",
          lastSignInTime: user.metadata.lastSignInTime,
          lastRefreshTime: user.metadata.lastRefreshTime,
        },
        providerData: user.providerData.map((provider) => ({
          uid: provider.uid,
          email: provider.email,
          displayName: provider.displayName,
          photoURL: provider.photoURL,
          providerId: provider.providerId,
          phoneNumber: provider.phoneNumber,
        })),
        customClaims: user.customClaims,
      }));

      allUsers = allUsers.concat(users);
      nextPageToken = listUsersResult.pageToken;
      pageCount++;

      console.log(
        `Fetched ${users.length} users from page ${pageCount}. ` +
        `Total so far: ${allUsers.length}`
      );
    } while (nextPageToken);

    console.log(`\nTotal users fetched: ${allUsers.length}`);
    console.log("Saving users to JSON file...");

    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, {recursive: true});
    }

    // Save to JSON file with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");
    const outputPath = path.join(outputDir, `users-${timestamp}.json`);

    fs.writeFileSync(
      outputPath,
      JSON.stringify({
        users: allUsers,
        exportedAt: new Date().toISOString(),
        summary: {
          totalUsers: allUsers.length,
          verifiedEmails: allUsers.filter((u) => u.emailVerified).length,
          usersWithDisplayName: allUsers.filter(
            (u) => u.displayName
          ).length,
          disabledUsers: allUsers.filter((u) => u.disabled).length,
          usersWithPhoneNumber: allUsers.filter(
            (u) => u.phoneNumber
          ).length,
        },
      }, null, 2)
    );

    console.log(
      `\n✅ Successfully saved ${allUsers.length} users to: ${outputPath}`
    );

    const summary = {
      totalUsers: allUsers.length,
      verifiedEmails: allUsers.filter((u) => u.emailVerified).length,
      usersWithDisplayName: allUsers.filter(
        (u) => u.displayName
      ).length,
      disabledUsers: allUsers.filter((u) => u.disabled).length,
      usersWithPhoneNumber: allUsers.filter(
        (u) => u.phoneNumber
      ).length,
    };

    console.log("\n📊 Summary:");
    console.log(`- Total users: ${summary.totalUsers}`);
    console.log(`- Verified emails: ${summary.verifiedEmails}`);
    console.log(
      `- Users with display name: ${summary.usersWithDisplayName}`
    );
    console.log(`- Disabled users: ${summary.disabledUsers}`);
    console.log(
      `- Users with phone number: ${summary.usersWithPhoneNumber}`
    );

    return {
      success: true,
      totalUsers: allUsers.length,
      summary,
      outputPath,
    };
  } catch (error) {
    console.error(
      "❌ Error fetching users or saving to JSON:",
      error
    );
    throw error;
  }
}

if (require.main === module) {
  // Comment out original function that saves to Firestore
  // fetchAllUsersAndSaveToFirestore()
  //   .then((result) => {
  //     console.log("\n🎉 Script completed successfully!");
  //     process.exit(0);
  //   })
  //   .catch((error) => {
  //     console.error("\n💥 Script failed:", error);
  //     process.exit(1);
  //   });

  // Use the new function that saves to JSON instead
  fetchAllUsersAndSaveToJson()
    .then((result) => {
      console.log("\n🎉 Script completed successfully!");
      console.log(`JSON file saved to: ${result.outputPath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script failed:", error);
      process.exit(1);
    });
}

export {fetchAllUsersAndSaveToFirestore};
