import {onSchedule, ScheduledEvent} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {Resend} from "resend";
import * as fs from "fs";
import * as path from "path";
import {createClient} from "@supabase/supabase-js";

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
