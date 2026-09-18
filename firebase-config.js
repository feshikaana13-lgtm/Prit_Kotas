import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgAHWO0iYHH8TPQMaalmyFCwXZQIWggZ0",
  authDomain: "prit-kotas-bps.firebaseapp.com",
  projectId: "prit-kotas-bps",
  storageBucket: "prit-kotas-bps.firebasestorage.app",
  messagingSenderId: "1039684363303",
  appId: "1:1039684363303:web:79f71d1b03e4e21a735a02"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const KOLEKSI_KONSULTASI_DTSEN = "konsultasi_dtsen";

