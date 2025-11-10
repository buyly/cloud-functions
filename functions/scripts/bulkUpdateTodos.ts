import * as admin from "firebase-admin";
import * as path from "path";
import * as dotenv from "dotenv";

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

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  userId: string;
  createdAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
}

/**
 * Bulk update todos in Firestore to add createdAt field with server timestamp
 * @return {Promise<Object>} Result object with operation statistics
 */
async function bulkUpdateTodosWithCreatedAt() {
  try {
    console.log(
      "Starting bulk update of todos to add createdAt field..."
    );

    const todosCollection = db.collection("todos");
    const todosSnapshot = await todosCollection.get();

    if (todosSnapshot.empty) {
      console.log("No todos found in the collection.");
      return {
        success: true,
        totalTodos: 0,
        updatedTodos: 0,
        skippedTodos: 0,
      };
    }

    console.log(`Found ${todosSnapshot.size} todos to process...`);

    const batch = db.batch();
    let batchCount = 0;
    const batchSize = 500;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of todosSnapshot.docs) {
      const todoData = doc.data() as Todo;

      // Skip if createdAt already exists
      if (todoData.createdAt) {
        console.log(
          `Skipping todo ${doc.id} - already has createdAt`
        );
        skippedCount++;
        continue;
      }

      // Add createdAt field with server timestamp
      const todoRef = todosCollection.doc(doc.id);
      batch.update(todoRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      updatedCount++;
      batchCount++;

      // Commit batch when it reaches the limit
      if (batchCount === batchSize) {
        console.log(
          `Committing batch with ${batchCount} updates...`
        );
        await batch.commit();

        // Reset batch
        const newBatch = db.batch();
        Object.setPrototypeOf(batch, Object.getPrototypeOf(newBatch));
        Object.assign(batch, newBatch);

        batchCount = 0;
      }
    }

    // Commit remaining updates in batch
    if (batchCount > 0) {
      console.log(
        `Committing final batch with ${batchCount} updates...`
      );
      await batch.commit();
    }

    console.log(
      `\n✅ Successfully processed ${todosSnapshot.size} todos!`
    );
    console.log(`- Updated: ${updatedCount} todos`);
    console.log(
      `- Skipped: ${skippedCount} todos (already had createdAt)`
    );

    return {
      success: true,
      totalTodos: todosSnapshot.size,
      updatedTodos: updatedCount,
      skippedTodos: skippedCount,
    };
  } catch (error) {
    console.error("❌ Error updating todos:", error);
    throw error;
  }
}

if (require.main === module) {
  bulkUpdateTodosWithCreatedAt()
    .then((result) => {
      console.log("\n🎉 Script completed successfully!");
      console.log(`Total todos processed: ${result.totalTodos}`);
      console.log(`Todos updated: ${result.updatedTodos}`);
      console.log(`Todos skipped: ${result.skippedTodos}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script failed:", error);
      process.exit(1);
    });
}

export {bulkUpdateTodosWithCreatedAt};
