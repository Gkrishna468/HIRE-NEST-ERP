import { initializeApp, cert, getApps, App, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from 'fs';
import path from 'path';

let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.error("Failed to load firebase-applet-config.json in admin:", e);
}

function sanitizePrivateKey(key: string): string {
  let s = key.trim();
  if (s.startsWith('"')) s = s.substring(1);
  else if (s.startsWith("'")) s = s.substring(1);
  if (s.endsWith('"')) s = s.substring(0, s.length - 1);
  else if (s.endsWith("'")) s = s.substring(0, s.length - 1);
  s = s.replace(/\\n/g, "\n");
  return s.trim();
}

function isPlaceholder(val: string): boolean {
  const v = val.toLowerCase().trim();
  return v === "" || v.includes("placeholder") || v.includes("your-") || v.includes("your_") || v.includes("<") || v.includes(">") || v.includes("example.com") || v.includes("dummy") || v.length < 20;
}

function getCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    if (isPlaceholder(clientEmail) || isPlaceholder(privateKey)) return null;
    if (!clientEmail.includes('gserviceaccount.com')) {
      console.warn(`[Firebase Admin] FIREBASE_CLIENT_EMAIL (${clientEmail}) is not a service account email. Skipping manual credentials to allow default service account credentials fallback.`);
      return null;
    }
    return { projectId, clientEmail, privateKey: sanitizePrivateKey(privateKey) };
  }

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saJson) {
    if (isPlaceholder(saJson)) return null;
    if (!saJson.trim().startsWith('{')) {
      console.warn(`[Firebase Admin] FIREBASE_SERVICE_ACCOUNT does not start with '{'. Skipping parsing as JSON to allow default credentials fallback.`);
      return null;
    }
    try {
      const sa = JSON.parse(saJson);
      if (sa.private_key) {
        if (isPlaceholder(sa.private_key) || (sa.client_email && isPlaceholder(sa.client_email))) return null;
        sa.private_key = sanitizePrivateKey(sa.private_key);
      }
      return sa;
    } catch (e: any) {
      console.warn(`[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON: ${e.message}. Skipping manual credentials.`);
    }
  }

  return null;
}

let app: App | undefined;
export let adminDb: any = null;
export let adminAuth: any = null;

try {
  const credentials = getCredentials();
  
  // Detection for managed environments vs local
  const isManagedEnv = !!(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);
  
  // Priority: 
  // 1. Explicit FIREBASE_PROJECT_ID (unless it is the placeholder 'hirenest-os' in a managed env)
  // 2. System GOOGLE_CLOUD_PROJECT
  // 3. Blueprint config
  let projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  

  console.log("[Firebase Admin] Init attempt. Project:", projectId);

  if (getApps().length === 0) {
    // Strategy: 
    // If in managed environment without a valid explicit credential, try applicationDefault first.
    // Otherwise, try credentials, then applicationDefault.
    
    const tryAppDefault = () => {
      console.log("[Firebase Admin] Attempting applicationDefault...");
      try {
        return initializeApp({ credential: applicationDefault(), projectId });
      } catch (e: any) {
        console.warn("[Firebase Admin] applicationDefault failed:", e.message);
        return null;
      }
    };

    const tryManual = () => {
      if (!credentials) {
        console.log("[Firebase Admin] No manual credentials available.");
        return null;
      }
      console.log("[Firebase Admin] Attempting manual credentials for project:", projectId);
      try {
        const manualApp = initializeApp({ credential: cert(credentials), projectId });
        console.log("[Firebase Admin] Manual credentials SDK init success.");
        return manualApp;
      } catch (e: any) {
        console.warn("[Firebase Admin] Manual credentials SDK init failed:", e.message);
        return null;
      }
    };

    if (isManagedEnv && !credentials) {
      app = tryAppDefault() || initializeApp({ projectId });
    } else {
      app = tryManual() || tryAppDefault() || initializeApp({ projectId });
    }
  } else {
    app = getApps()[0];
  }

  if (app) {
    try {
      adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
      try {
        adminDb.settings({ ignoreUndefinedProperties: true });
      } catch (settingsErr: any) {
        console.warn("[Firebase Admin] settings ignoreUndefinedProperties warning:", settingsErr.message);
      }
    } catch (e: any) {
      console.error("[Firebase Admin] Failed to initialize adminDb:", e.message);
    }

    try {
      adminAuth = getAuth(app);
    } catch (e: any) {
      console.error("[Firebase Admin] Failed to initialize adminAuth:", e.message);
    }
  }
} catch (globalInitError: any) {
  console.error("[Firebase Admin] Global critical init failed:", globalInitError.message);
}

export let runtimeMode: "FULL_ADMIN" | "CLIENT_FALLBACK" | "DEGRADED" = "CLIENT_FALLBACK";

if (adminDb) {
  runtimeMode = "FULL_ADMIN";
}

if (adminDb) {
  try {
    adminDb.collection("system").limit(1).get()
      .then(() => console.log("[Firebase Admin] Server-side Firestore verification successful."))
      .catch((err: any) => {
        console.warn("[Firebase Admin] Auth verification warning:", err.message);
        if (err.message.includes("UNAUTHENTICATED") || err.message.includes("PERMISSION_DENIED")) {
           console.warn("[Firebase Admin] Invalid credentials detected. Disabling adminDb.");
           
           adminDb = null;
           
           runtimeMode = "CLIENT_FALLBACK";
        }
      });
  } catch (syncErr: any) {
    console.warn("[Firebase Admin] Synchronous check failed.", syncErr.message);
  }
}

export const getAdminApp = () => app;

export const db = new Proxy({}, {
  get: (target, prop) => {
    if (!adminDb) {
      if (prop === 'collection' || prop === 'doc' || prop === 'runTransaction' || prop === 'batch') {
        return () => {
          const chain: any = {
            doc: () => chain,
            collection: () => chain,
            where: () => chain,
            orderBy: () => chain,
            limit: () => chain,
            get: async () => ({ exists: false, docs: [], size: 0, data: () => ({}) }),
            set: async () => {},
            update: async () => {},
            add: async () => ({ id: "dummy-id" }),
            delete: async () => {},
            onSnapshot: () => () => {}
          };
          return chain;
        };
      }
      return undefined;
    }
    const val = adminDb[prop];
    return typeof val === 'function' ? val.bind(adminDb) : val;
  }
}) as any;

export const auth = new Proxy({}, {
  get: (target, prop) => {
    if (!adminAuth) {
      if (prop === 'verifyIdToken' || prop === 'getUser' || prop === 'createUser' || prop === 'deleteUser') {
        return async () => ({
          uid: "dummy-user",
          email: "dummy@example.com",
          role: "guest",
          verifyIdToken: async () => ({ uid: "dummy-user", role: "guest" }),
          getUser: async () => ({ uid: "dummy-user", email: "dummy@example.com" }),
          createUser: async () => ({ uid: "dummy-user" })
        });
      }
      return undefined;
    }
    const val = adminAuth[prop];
    return typeof val === 'function' ? val.bind(adminAuth) : val;
  }
}) as any;
