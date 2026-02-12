import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBIYOpFIZxvlAShyJO2SABOGkY3NKsn73Y",
  authDomain: "agrocarbonc.firebaseapp.com",
  projectId: "agrocarbonc",
  storageBucket: "agrocarbonc.firebasestorage.app",
  messagingSenderId: "452062559178",
  appId: "1:452062559178:web:e61be48140447f08ff6d33",
  measurementId: "G-YCVM9DQ9XT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
