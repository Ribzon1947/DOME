importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC4PEHPsQ5MDKBLTIgKZJnPzc0hwsLsK8A",
  authDomain: "dome-cf56b.firebaseapp.com",
  projectId: "dome-cf56b",
  storageBucket: "dome-cf56b.firebasestorage.app",
  messagingSenderId: "384645773404",
  appId: "1:384645773404:web:8d32b738a1b2b2b2aece99",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Dome";
  const options = {
    body: payload.notification?.body || "",
    icon: "/favicon.svg",
    data: payload.data,
  };
  self.registration.showNotification(title, options);
});
