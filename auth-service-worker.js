
// auth-service-worker.js

import { initializeApp } from "firebase/app";
import { getAuth, getIdToken, onAuthStateChanged } from "firebase/auth";

// Extract Firebase config from query string
const serializedFirebaseConfig = new URLSearchParams(self.location.search).get(
  "firebaseConfig"
);
if (!serializedFirebaseConfig) {
  throw new Error(
    "Firebase Config object not found in service worker query string."
  );
}

const firebaseConfig = JSON.parse(serializedFirebaseConfig);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

self.addEventListener("install", () => {
  console.log("Service worker installed with Firebase config", firebaseConfig);
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { origin, pathname } = new URL(event.request.url);
  if (origin !== self.location.origin) return;

  // Use a magic URL to ensure that auth state is in sync between
  // the client and the service worker
  if (pathname.startsWith("/__/auth/wait/")) {
    const uid = pathname.split("/").at(-1);
    event.respondWith(waitForMatchingUid(uid));
    return;
  }

  if (pathname.startsWith("/_next/")) return;

  // Don't add headers to non-GET requests or those with an extension
  // This helps with CSS, images, fonts, JSON, etc.
  if ((event.request.method === "GET" || event.request.method === "POST") && !pathname.includes(".")) {
    event.respondWith(fetchWithFirebaseHeaders(event.request));
  }
});

async function fetchWithFirebaseHeaders(request) {
  let authIdToken = await getAuthIdToken();
  if (!authIdToken) {
    // sleep for 0.25s
    await new Promise((resolve) => setTimeout(resolve, 250));
    authIdToken = await getAuthIdToken();
  }
  if (!authIdToken) {
    // sleep for 0.25s
    await new Promise((resolve) => setTimeout(resolve, 250));
    authIdToken = await getAuthIdToken();
  }
  if (authIdToken) {
    const headers = new Headers(request.headers);
    headers.append("Authorization", `Bearer ${authIdToken}`);
    request = new Request(request, { headers });
  }
  return await fetch(request).catch((reason) => {
    console.error(reason);
    return new Response("Fail.", {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  });
}

async function waitForMatchingUid(_uid) {
  const uid = _uid === "undefined" ? undefined : _uid;
  await authStateReady();
  await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.uid === uid) {
        unsubscribe();
        resolve();
      }
    });
  });
  return new Response(undefined, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

function authStateReady() {
  return new Promise((resolve) => {
    if (auth.currentUser !== undefined) {
      resolve();
    } else {
      const unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe();
        resolve();
      });
    }
  });
}

async function getAuthIdToken() {
  await authStateReady();
  if (!auth.currentUser) return null;
  return await getIdToken(auth.currentUser);
}
