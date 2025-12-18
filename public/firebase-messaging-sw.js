/* public/firebase-messaging-sw.js */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBJEoTR6w1Sx7wHQaKv4gSrSSjOpQS179s",
  authDomain: "academiazen-481609.firebaseapp.com",
  projectId: "academiazen-481609",
  storageBucket: "academiazen-481609.appspot.com",
  messagingSenderId: "248064186308",
  appId: "1:248064186308:web:e0999ae615a6a27c13b691"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(
    payload.notification?.title || 'AcademiaZen',
    {
      body: payload.notification?.body || 'You have a new notification',
      icon: '/icon-192.png'
    }
  );
});
