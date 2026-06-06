// MANUAL TASK: Run this in Supabase SQL Editor:
// alter table profiles add column if not exists fcm_token text;

import admin from 'firebase-admin';
import { createRequire } from 'module';
import { log } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const serviceAccount = require('../../firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  log.info('Firebase Admin initialized successfully');
}

export const messaging = admin.messaging();
export default admin;
