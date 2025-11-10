# Firebase Service Account Setup

To run admin scripts locally, you need to create a service account key file:

## Steps to create a service account key:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Project Settings (gear icon) > Service accounts
4. Click "Generate new private key"
5. Save the JSON file as `service-account-key.json` in the root of your Buyly project (one level above the functions directory)
6. Make sure to add this file to `.gitignore` to avoid committing sensitive credentials

## Security Warning:

- Keep this file secure and NEVER commit it to version control
- Only share it with trusted team members
- Consider using environment variables in production environments instead

After creating the service account key file, you can run the admin script:

```bash
cd functions
npx ts-node scripts/setUserAsAdmin.ts
```

```bash
firebase logout
```

firebase logout and login again S

```bash
npx ts-node scripts/bulkUpdateTodos.ts
```

```bash
cd functions
npm run build
```

```bash
npx eslint --ext .js,.ts . --fix
```

Try deploying specific functions: Instead of deploying all functions at once, you can try deploying just the new function:

```bash
firebase deploy --only functions:onUserCreate
```

```bash
firebase deploy --only functions
```

```bash
firebase deploy
```

[Firebase Cloud Functions](https://firebase.google.com/docs/functions/config-env?gen=2nd)
