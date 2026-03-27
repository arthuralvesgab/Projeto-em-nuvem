import * as admin from 'firebase-admin';
import { env } from '../config/env';

function getFirebaseCredential() {
  const serviceAccountJson = env.firebaseServiceAccountJson;

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return admin.credential.cert(parsed);
    } catch (error) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON invalido:', error);
      throw error;
    }
  }

  return admin.credential.applicationDefault();
}

function initializeFirebaseServices() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: getFirebaseCredential(),
      });
      console.log('Firebase Admin inicializado com sucesso.');
    } catch (error) {
      console.error('Erro ao inicializar Firebase Admin:', error);
    }
  }

  return {
    db: admin.firestore(),
    auth: admin.auth()
  };
}

const services = initializeFirebaseServices();

export let db = services.db;
export let auth = services.auth;

export function setFirebaseServices(next: { db: typeof db; auth: typeof auth }) {
  db = next.db;
  auth = next.auth;
}
