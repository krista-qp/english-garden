// Loads Firebase (Firestore + anonymous Auth) from the CDN on demand.
import { firebaseConfig } from '../config.js';

const BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
let pending = null;

export function isConfigured() {
  return !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);
}

/** Resolves {F (firestore module), db}. Rejects when offline or not configured. */
export function connect() {
  if (!isConfigured()) return Promise.reject(new Error('not configured'));
  if (!pending) {
    pending = (async () => {
      const [{ initializeApp }, { getAuth, signInAnonymously }, F] = await Promise.all([
        import(BASE + 'firebase-app.js'),
        import(BASE + 'firebase-auth.js'),
        import(BASE + 'firebase-firestore.js'),
      ]);
      const app = initializeApp(firebaseConfig);
      await signInAnonymously(getAuth(app));
      return { F, db: F.getFirestore(app) };
    })();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
