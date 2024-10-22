import { initializeApp } from "firebase/app";
import { getAuth, getIdToken } from "firebase/auth";
import { getInstallations, getToken } from "firebase/installations";

// this is set during install
let firebaseConfig;

self.addEventListener('install', event => {
  // extract firebase config from query string
  const serializedFirebaseConfig = new URL(location).searchParams.get('firebaseConfig');
  
  if (!serializedFirebaseConfig) {
    throw new Error('Firebase Config object not found in service worker query string.');
  }
  
  firebaseConfig = JSON.parse(serializedFirebaseConfig);
  console.log("Service worker installed with Firebase config", firebaseConfig);
});

self.addEventListener("fetch", (event) => {
  /* 
  
  FIX FROM https://github.com/firebase/friendlyeats-web/issues/295#issuecomment-2318574547
  
    firebase env vars not saved in firebaseConfig

  FIX START 
  */
  if (!firebaseConfig) {
    const serializedFirebaseConfig = new URL(location).searchParams.get(
      "firebaseConfig"
    );
    firebaseConfig = JSON.parse(serializedFirebaseConfig);
  }
  /* FIX END */
  /* 
  
  FIX FROM https://github.com/firebase/friendlyeats-web/pull/307#issuecomment-2359673660
  
    make sure currentUser is not null (part 1 of 2)

  FIX START 
  */
 /*
  const { origin } = new URL(event.request.url);
  if (origin !== self.location.origin) return;
  event.respondWith(fetchWithFirebaseHeaders(event.request));
  */

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

  // Don't add headers to non-GET/POST requests or those with an extension
  // This helps with CSS, images, fonts, JSON, etc.
  if ((event.request.method === "GET" || event.request.method === "POST") && !pathname.includes(".")) {
    event.respondWith(fetchWithFirebaseHeaders(event.request));
  }
  /* FIX END */
});

async function fetchWithFirebaseHeaders(request) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const installations = getInstallations(app);
  const headers = new Headers(request.headers);
  /* 
  
  FIX FROM https://github.com/firebase/friendlyeats-web/pull/307#issuecomment-2395066549
  
    make sure currentUser is not null (part 2 of 2)

  FIX START 
  */
 /*
  const [authIdToken, installationToken] = await Promise.all([
    getAuthIdToken(auth),
    getToken(installations),
  ]);
  */
  let [authIdToken, installationToken] = await Promise.all([
    getAuthIdToken(auth),
    getToken(installations),
  ]);
  if (!authIdToken) {
    console.log("authIdToken null once");
    // sleep for 0.25s
    await new Promise((resolve) => setTimeout(resolve, 250));
    authIdToken = await getAuthIdToken();
  }
  if (!authIdToken) {
    console.log("authIdToken null twice");
    // sleep for 0.25s
    await new Promise((resolve) => setTimeout(resolve, 250));
    authIdToken = await getAuthIdToken();
  }
  /* FIX END */
  headers.append("Firebase-Instance-ID-Token", installationToken);
  if (authIdToken) headers.append("Authorization", `Bearer ${authIdToken}`);
  const newRequest = new Request(request, { headers });
  return await fetch(newRequest);
}

async function getAuthIdToken(auth) {
  await auth.authStateReady();
  if (!auth.currentUser) return;
  return await getIdToken(auth.currentUser);
}
