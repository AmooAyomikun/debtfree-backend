import admin from 'firebase-admin';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { log } from '../utils/logger.js';

let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Production: Render provides JSON as env variable
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    log.info('Firebase: using environment variable credentials');
  } else {
    // Local: use file
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    serviceAccount = require('../../firebase-service-account.json');
    log.info('Firebase: using local service account file');
  }
} catch (error) {
  log.error('Firebase initialization error:', error);
  serviceAccount = null;
}

if (serviceAccount && !getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  log.info('Firebase Admin initialized successfully');
}

export const messaging = getApps().length ? getMessaging() : null;
export default admin;
