import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC4PEHPsQ5MDKBLTIgKZJnPzc0hwsLsK8A",
  authDomain: "dome-cf56b.firebaseapp.com",
  projectId: "dome-cf56b",
  storageBucket: "dome-cf56b.firebasestorage.app",
  messagingSenderId: "384645773404",
  appId: "1:384645773404:web:8d32b738a1b2b2b2aece99",
  measurementId: "G-KJPW489Z59"
};

const VAPID_KEY = "BGdCdAwOWV_oYPj2Jghp1JuyZH35tXcUCnZwgtTB-vhMsaO0U9wuN7mj9eqTnfWB3Cu7LRM5RYfOGlMhKpZ2S88c";

const app = initializeApp(firebaseConfig);
let messaging: Messaging | null = null;

try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn("FCM not supported in this browser:", err);
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch (err) {
    console.error("Failed to get FCM token:", err);
    return null;
  }
}

export function listenForMessages(handler: (payload: any) => void) {
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}