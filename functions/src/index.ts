/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {initializeApp} from "firebase-admin/app";

// Initialize Firebase Admin once at the top level
initializeApp();

// Import functions from their respective modules
export {sendGroceryItemsCount} from
  "./functions/sendGroceryItemsCount/index.js";
export {sendGroceryItemsCountRequest} from
  "./functions/sendGroceryItemsCountRequest/index.js";
export {hello} from "./functions/hello/index.js";
export {sendWelcomeEmail} from "./functions/sendWelcomeEmail/index.js";
export {onUserDeleted} from "./functions/onUserDeleted/index.js";
export {getUserIACredits} from "./functions/getUserIACredits/index.js";
export {onCreateUser} from "./functions/onCreateUser/index.js";
export {addCreditsToUser} from "./functions/addCreditsToUser/index.js";
export {checkBudgetAlert} from "./functions/checkBudgetAlert/index.js";
export {testBudgetAlert} from "./functions/testBudgetAlert/index.js";
