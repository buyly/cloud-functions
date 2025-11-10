/**
 * Shared Firebase Client Code
 * This module provides reusable Firebase client initialization and utilities
 */

import * as admin from 'firebase-admin';

/**
 * Initialize Firebase Admin SDK
 * This should be called once at the start of your application
 */
export function initializeFirebaseAdmin(): admin.app.App {
  if (admin.apps.length === 0) {
    return admin.initializeApp();
  }
  return admin.app();
}

/**
 * Get Firestore instance
 */
export function getFirestore(): admin.firestore.Firestore {
  return admin.firestore();
}

/**
 * Get Firebase Auth instance
 */
export function getAuth(): admin.auth.Auth {
  return admin.auth();
}

/**
 * Get Firebase Storage instance
 */
export function getStorage(): admin.storage.Storage {
  return admin.storage();
}

/**
 * Environment configuration helper
 */
export interface FirebaseConfig {
  resendApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

/**
 * Validate required environment variables
 */
export function validateEnv(required: (keyof FirebaseConfig)[]): void {
  const missing: string[] = [];

  required.forEach((key) => {
    const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
    if (!process.env[envKey]) {
      missing.push(envKey);
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Get environment configuration
 */
export function getConfig(): FirebaseConfig {
  return {
    resendApiKey: process.env.RESEND_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  };
}
