import {onDocumentDeleted} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

interface GroceryListItem {
  id?: string;
  GroceryListId: string | null;
  count: number;
  createdAt: string;
  created_at: string;
  deletedAt: string | null;
  imgUrl: string;
  isBought: boolean;
  name: string;
  price: {
    amount: number;
    currency: string;
  };
  shop: string | null;
  updatedAt: string;
  updated_at: string;
  userId: string;
}

interface ReceiptItem {
  i: string; // item name
  p: number; // price
}

interface ReceiptExtractionMetadata {
  imageUrl: string;
  userId: string;
  extractedAt: string;
  tokensUsed: number;
}

interface ReceiptExtractionResponse {
  success: boolean;
  items: ReceiptItem[];
  metadata: ReceiptExtractionMetadata;
}

interface GroceryHistoryItem {
  id?: string;
  date: string;
  items: GroceryListItem[];
  totalAmount: number;
  userId: string;
  receiptURL?: string | null;
  receiptExtraction?: ReceiptExtractionResponse | null;
}

/**
 * Firestore trigger that runs when a history item is deleted
 * Deletes associated receipt from R2 storage if it exists
 */
export const onHistoryItemDeleted = onDocumentDeleted(
  "history-items/{historyItemId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("No data associated with the delete event");
      return;
    }

    const historyItemId = event.params.historyItemId;
    const historyItemData = snapshot.data() as GroceryHistoryItem;

    logger.info(`History item deleted: ${historyItemId}`);

    // Check if the history item has a receipt URL
    if (!historyItemData.receiptURL) {
      logger.info(
        `No receipt URL found for history item ${historyItemId}, skipping deletion`
      );
      return;
    }

    try {
      // Validate environment variables
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        logger.error(
          "SUPABASE_URL or SUPABASE_ANON_KEY environment variable is not set!"
        );
        throw new Error(
          "SUPABASE_URL or SUPABASE_ANON_KEY environment variable is not set!"
        );
      }

      const deleteReceiptUrl = `${process.env.SUPABASE_URL}/functions/v1/delete-receipt`;

      logger.info(
        `Deleting receipt from R2 storage: ${historyItemData.receiptURL}`
      );

      // Call Supabase function to delete receipt from R2
      const response = await fetch(deleteReceiptUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: historyItemData.receiptURL,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `Failed to delete receipt: ${response.status} - ${errorText}`
        );
        throw new Error(
          `Failed to delete receipt: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();
      logger.info("Successfully deleted receipt from R2:", result);
    } catch (error) {
      logger.error(
        `Error deleting receipt for history item ${historyItemId}:`,
        error
      );
      // Don't throw - we don't want to fail the deletion trigger
      // even if the receipt deletion fails
    }
  }
);
