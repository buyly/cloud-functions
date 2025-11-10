import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import {sendWelcomeEmail as sendWelcomeEmailHelper} from
  "../../helpers/sendWelcomeEmail";

// Send welcome email
export const sendWelcomeEmail = functions.auth.user().onCreate(async (user) => {
  const {email, displayName} = user;
  logger.info("Email sent successfully:", user);

  if (!email) {
    logger.error("User email not found");
    return {success: false, error: "User email or display name not found"};
  }

  try {
    const data = await sendWelcomeEmailHelper(email, displayName ?? "there");
    logger.info("Email sent successfully:", data);
    return {success: true};
  } catch (error) {
    console.error("Error sending email:", error);
    return {success: false, error: (error as Error).message};
  }
});
