# Buyly Firebase Functions

Shared Firebase Functions repository for Buyly applications. This repository is designed to be used as a Git submodule in both `buyly-app` and `buyly-app-update`.

## Structure

```
buyly-firebase-functions/
├── src/
│   ├── index.ts           # Main Cloud Functions entry point
│   ├── functions/         # Individual function implementations
│   ├── helpers/           # Helper utilities
│   └── email-templates/   # Email template assets
├── packages/
│   └── firebase-core/     # Shared client code package
│       ├── src/
│       │   ├── client.ts  # Firebase utilities
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── scripts/               # Admin scripts
├── package.json
├── tsconfig.json
└── .gitignore
```

## Usage as a Submodule

### Adding to your project

```bash
# In buyly-app or buyly-app-update root directory
git submodule add <repository-url> functions
git submodule update --init --recursive
```

### Cloning a project with submodules

```bash
git clone --recurse-submodules <project-url>

# Or if already cloned:
git submodule update --init --recursive
```

### Updating the submodule

```bash
cd functions
git pull origin main
cd ..
git add functions
git commit -m "Update functions submodule"
```

## Using the Shared Client Code

The `packages/firebase-core` package provides reusable Firebase client utilities:

```typescript
import {
  initializeFirebaseAdmin,
  getFirestore,
  getAuth,
  validateEnv,
  getConfig
} from './functions/packages/firebase-core/src';

// Initialize Firebase (call once at startup)
initializeFirebaseAdmin();

// Validate required environment variables
validateEnv(['resendApiKey', 'supabaseUrl']);

// Get Firebase services
const db = getFirestore();
const auth = getAuth();
const config = getConfig();
```

## Development

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build

# Watch mode
npm run build:watch

# Lint and fix
npx eslint --ext .js,.ts . --fix
```

### Local development

```bash
# Start Firebase emulators
npm run serve
```

### Deploy to Firebase

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:onUserCreate

# Full deploy
firebase deploy
```

## Environment Variables

Create a `.env` file in the functions directory (this file is gitignored):

```env
RESEND_API_KEY=your_resend_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important:** Never commit the following files:
- `.env` files
- `service-account-key.json`
- Any credential files

These are automatically excluded via `.gitignore`.

## Service Account Setup

To run admin scripts locally, you need a service account key:

### Steps:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Project Settings (gear icon) > Service accounts
4. Click "Generate new private key"
5. Save the JSON file as `service-account-key.json` in this directory
6. The file is already gitignored

### Running admin scripts:

```bash
npx ts-node scripts/setUserAsAdmin.ts
npx ts-node scripts/bulkUpdateTodos.ts
```

**Security Warning:** Never commit service account keys to version control!

## Firebase Functions Available

- `sendGroceryItemsCount` - Daily scheduled function to send grocery items report
- `sendWelcomeEmail` - Welcome email on user creation
- `sendBudgetAlertEmail` - Budget alert notifications
- `onUserCreate` - User creation handler

## Shared Client Package

The `@buyly/firebase-core` package provides:

- `initializeFirebaseAdmin()` - Initialize Firebase Admin SDK
- `getFirestore()` - Get Firestore instance
- `getAuth()` - Get Auth instance
- `getStorage()` - Get Storage instance
- `validateEnv()` - Validate required environment variables
- `getConfig()` - Get environment configuration

### Building the client package

```bash
cd packages/firebase-core
npm install
npm run build
```

## Contributing

When making changes:

1. Make your changes in this repository
2. Test locally using the emulators
3. Commit and push to the functions repository
4. Update the submodule reference in `buyly-app` and `buyly-app-update`

## Resources

- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions/config-env?gen=2nd)
