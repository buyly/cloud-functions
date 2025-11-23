# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Buyly is a grocery list management application with AI features. This repository contains serverless cloud functions using both **Firebase Cloud Functions** (Node.js) and **Supabase Edge Functions** (Deno). The project is transitioning from Firebase to Supabase, with both systems currently active.

## Development Commands

### Firebase Functions

**Working Directory:** `firebase-functions/functions/`

```bash
# Build functions (compiles TypeScript and copies email templates)
npm run build

# Build with watch mode
npm run build:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint -- --fix

# Local development with emulators
npm run serve

# View function logs
npm run logs

# Deploy all functions
npm run deploy

# Deploy specific function
firebase deploy --only functions:onUserCreate

# Deploy Firestore security rules
firebase deploy --only firestore:rules
```

### Supabase Functions

**Working Directory:** `supabase-functions/`

```bash
# Serve function locally (requires Docker Desktop)
supabase functions serve hello-world

# Deploy function
supabase functions deploy upload-receipt

# Set environment secrets
supabase secrets set --env-file .env
```

### Admin Scripts

**Working Directory:** `firebase-functions/functions/`

Requires `service-account-key.json` in project root (see Firebase console > Project Settings > Service accounts).

```bash
# Set user as admin
npx ts-node scripts/setUserAsAdmin.ts

# Bulk update todos
npx ts-node scripts/bulkUpdateTodos.ts
```

## Architecture

### Dual Cloud Setup

- **Firebase Functions**: Legacy system handling authentication, notifications, emails, and business logic
- **Supabase Edge Functions**: New system for receipt uploads and future features
- **Databases**: Firestore (Firebase) for main data, PostgreSQL (Supabase) for new features
- **Storage**: Cloudflare R2 (S3-compatible) for receipt images

### Firebase Functions Organization

All functions are exported from [src/index.ts](firebase-functions/functions/src/index.ts). Individual implementations are in [src/functions/](firebase-functions/functions/src/functions/) with one directory per function.

**Key Functions:**
- `onCreateUser` - Initializes new user documents with 1000 free AI credits
- `inviteUserToGroceryList` - Handles both registered users (push notification) and non-registered users (email invite)
- `checkBudgetAlert` - Monitors spending and sends alerts at 50% threshold
- `onGroceryItemAdded` - Triggers notifications when items are added to shared lists
- `addCreditsToUser` / `getUserIACredits` - Manages AI credit system

### Firestore Data Structure

**Collections:**
- `users` - User profiles, AI credits (daily/monthly tracking), admin status
- `grocery-lists` - List metadata, owner, shared members
- `grocery-items` - Individual items with budget tracking
- `notifications` - In-app notifications with read/dismissed states
- `push-tokens` - Expo push notification tokens per user
- `budget-alerts` - Deduplication tracking by month/year
- `history-items` - Historical data

### Push Notification System

Uses Expo SDK with batch processing:
1. User actions trigger notification functions
2. Retrieve Expo tokens from `push-tokens` collection
3. Batch tokens into chunks (Expo requirement)
4. Send via `expo-server-sdk` with error handling
5. Helper function: [src/helpers/sendPushNotification.ts](firebase-functions/functions/src/helpers/sendPushNotification.ts)

**Important:** Always validate Expo tokens match expected format before sending.

### Email System

Uses Resend API with HTML templates in [src/email-templates/](firebase-functions/functions/src/email-templates/).

**Template Pattern:**
1. Read HTML template file
2. Replace placeholders (e.g., `{{userName}}`, `{{budgetAmount}}`)
3. Send via Resend API helper
4. Helpers: [src/helpers/sendWelcomeEmail.ts](firebase-functions/functions/src/helpers/sendWelcomeEmail.ts), [src/helpers/sendBudgetAlertEmail.ts](firebase-functions/functions/src/helpers/sendBudgetAlertEmail.ts), [src/helpers/sendGroceryListInviteEmail.ts](firebase-functions/functions/src/helpers/sendGroceryListInviteEmail.ts)

**Note:** Email templates must be copied to `lib/` during build (`npm run build` handles this).

### Invitation Flow

When inviting users to grocery lists ([src/functions/inviteUserToGroceryList/](firebase-functions/functions/src/functions/inviteUserToGroceryList/)):

1. Check if invitee is registered (query `users` collection by email)
2. **Registered user:** Create notification document + send push notification
3. **Non-registered user:** Send email invitation with app download link
4. Verify inviter has permission (owner or existing member)

### AI Credits System

New users start with 1000 free credits ([src/functions/onCreateUser/](firebase-functions/functions/src/functions/onCreateUser/)). Credits document tracks:
- Total credits remaining
- Daily/monthly usage statistics
- Token consumption per API call
- Estimated USD cost
- Multiple model support

### Security Rules

Firestore rules ([firestore.rules](firebase-functions/firestore.rules)) enforce:
- Admin role checks (`isAdmin` helper)
- User ownership verification
- Grocery list member validation for shared lists
- Admin override capability for debugging

### Supabase Functions

Edge functions use Deno runtime.

**Available Functions:**
- `upload-receipt` - Generates presigned URLs for direct R2 uploads
- `extract-receipt` - AI-powered receipt data extraction
- `hello-world` - Example/test function for local development

#### upload-receipt Function

**Purpose:** Generates presigned URLs for clients to upload receipt images directly to Cloudflare R2 storage.

**Two-Step Upload Process:**

1. **Client requests presigned URL from Supabase function:**
   ```bash
   curl 'https://PROJECT.supabase.co/functions/v1/upload-receipt' \
     -H 'Authorization: Bearer ANON_KEY' \
     -H 'Content-Type: application/json' \
     -d '{"contentType": "image/png", "extension": "png"}'
   ```

   Response includes:
   - `uploadUrl` - Temporary S3 presigned URL (valid 10 minutes)
   - `publicUrl` - Permanent public URL after upload
   - `filename` - Generated unique filename

2. **Client uploads directly to R2 using presigned URL:**
   ```bash
   curl -X PUT 'UPLOAD_URL' \
     -H 'Content-Type: image/png' \
     --data-binary '@receipt.png'
   ```

**Why Presigned URLs?**
- Direct uploads from Supabase Edge Functions to R2 timeout due to network issues
- Presigned URLs allow clients to upload directly to R2 (faster, more reliable)
- Function only generates signed URLs (instant response)

**Environment Variables Required (upload-receipt):**
- `R2_ENDPOINT` - Cloudflare R2 endpoint URL
- `R2_ACCESS_KEY` - R2 Access Key ID
- `R2_SECRET_KEY` - R2 Secret Access Key
- `R2_BUCKET` - R2 bucket name (e.g., "buylyreceipts")
- `R2_PUBLIC_BASE` - Public CDN URL (e.g., "https://core.buyly.co.za")

**Deployment:**
```bash
cd supabase-functions
supabase secrets set --project-ref PROJECT_REF --env-file .env
supabase functions deploy upload-receipt --project-ref PROJECT_REF
```

**Testing Locally:**
```bash
# Test R2 credentials
deno run --allow-net --allow-env --allow-sys test-r2.ts
```

#### extract-receipt Function

**Purpose:** Extracts structured data from receipt images using AI vision models (GPT-4 Vision, Claude, etc.) via OpenRouter API.

**Usage Flow:**
1. Client uploads receipt using `upload-receipt` function → receives `publicUrl`
2. Client calls `extract-receipt` with the `publicUrl` → receives structured JSON data
3. Client stores extracted items in Firestore/Supabase database

**Request:**
```bash
curl 'https://PROJECT.supabase.co/functions/v1/extract-receipt' \
  -H 'Authorization: Bearer ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "imageUrl": "https://core.buyly.co.za/receipt-xxx.png",
    "userId": "user123"
  }'
```

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "merchant": "Whole Foods",
    "date": "2025-11-21",
    "items": [
      {
        "name": "Organic Bananas",
        "quantity": 1,
        "price": 2.99,
        "category": "produce"
      }
    ],
    "subtotal": 7.49,
    "tax": 0.60,
    "total": 8.09,
    "currency": "USD",
    "confidence": 0.95
  },
  "metadata": {
    "imageUrl": "https://core.buyly.co.za/receipt-xxx.png",
    "userId": "user123",
    "extractedAt": "2025-11-21T10:30:00Z",
    "tokensUsed": 1250
  }
}
```

**Item Categories:**
AI automatically categorizes items as: `groceries`, `produce`, `dairy`, `meat`, `beverages`, `snacks`, `household`, `other`

**Environment Variables Required (extract-receipt):**
- `OPENROUTER_API_KEY` - OpenRouter API key for AI vision models

**Supported Models (via OpenRouter):**
- `nvidia/nemotron-nano-12b-v2-vl:free` (default) - NVIDIA's free vision model with reasoning
- `gpt-4o` - OpenAI's GPT-4 with vision
- `anthropic/claude-3.5-sonnet` - Claude 3.5 Sonnet
- `google/gemini-pro-vision` - Google Gemini Pro Vision

To change model, edit the `model` field in [extract-receipt/index.ts](supabase-functions/supabase/functions/extract-receipt/index.ts).

**Deployment:**
```bash
cd supabase-functions
supabase secrets set --project-ref PROJECT_REF --env-file .env
supabase functions deploy extract-receipt --project-ref PROJECT_REF
```

**Testing Locally:**
```bash
supabase functions serve extract-receipt
```

**Important Notes:**
- Function uses NVIDIA Nemotron (free model) by default - no per-request cost
- Processing time: 3-10 seconds depending on image size and model
- Maximum image size: 20MB (recommended: <5MB for faster processing)
- Confidence score indicates AI's certainty (0.0-1.0)
- Reasoning feature enabled for improved accuracy

## Important Patterns

### Budget Alert Deduplication

Budget alerts are sent only once per month. Check [src/functions/checkBudgetAlert/](firebase-functions/functions/src/functions/checkBudgetAlert/):
1. Query `budget-alerts` collection for existing alert in current month/year
2. If found, skip sending
3. If not found, send email and create deduplication document

### TypeScript Type Safety

All functions use strict TypeScript with interfaces for request/response payloads. When adding functions:
- Define clear interfaces for input data
- Use Firebase logger for errors
- Return appropriate HTTP status codes
- Include try-catch blocks with detailed error messages

### Testing Functions

Test functions exist for development:
- `testPushNotification` - Verify Expo integration
- `testBudgetAlert` - Test email sending and budget logic

**Do not deploy test functions to production.**

## Configuration Files

- [firebase.json](firebase-functions/firebase.json) - Firebase project config, predeploy hooks
- [tsconfig.json](firebase-functions/functions/tsconfig.json) - TypeScript compiler settings (CommonJS, ES2017)
- [config.toml](supabase-functions/supabase/config.toml) - Supabase local development settings
- [deno.json](supabase-functions/supabase/functions/deno.json) - Deno import maps and JSX config

## Troubleshooting

### R2 Upload Issues

**Symptom:** "SignatureDoesNotMatch" error
- **Cause:** Invalid R2 credentials in `.env` file
- **Fix:** Get fresh credentials from Cloudflare Dashboard → R2 → Manage API Tokens
- **Update:** Edit `supabase-functions/.env` and run `supabase secrets set --env-file .env`

**Symptom:** Function hangs/timeouts
- **Cause:** Network connectivity issues between Supabase Edge Functions and R2
- **Fix:** Use presigned URL approach (already implemented in upload-receipt)
- **Don't:** Try to upload directly from edge function to R2

**Symptom:** CORS errors
- **Fix:** Ensure R2 bucket has CORS configured (`r2-cors-config.json`)
- **Command:** `./update-r2-cors.sh`

### Supabase Function Deployment

**Project not linked:**
```bash
# Use --project-ref instead
supabase functions deploy FUNCTION_NAME --project-ref PROJECT_REF
```

**View function logs:**
- Go to Supabase Dashboard → Functions → Select function → Logs
- Old CLI version doesn't support `functions logs` command

## Project-Specific Notes

- **Node version:** 20 (specified in package.json engines)
- **Firebase project:** getbuyly (see .firebaserc)
- **Firestore location:** eur3 (Europe)
- **Supabase project ref:** zbisfbcmgypcxokydnwc
- **Service account keys:** Required for admin scripts, never commit to git
- **Email service:** Resend (requires RESEND_API_KEY in Firebase Functions)
- **Push notifications:** Expo (requires EXPO_ACCESS_TOKEN in Firebase Functions)
- **AI service:** OpenRouter (requires OPENROUTER_API_KEY in Supabase Functions)
- **R2 Storage:** Cloudflare R2 bucket "buylyreceipts" with public CDN at core.buyly.co.za
- **Migration status:** Active transition from Firebase to Supabase; maintain compatibility with both systems
