import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const firebaseConfig = {
  projectId: "my-to-do-list-5a938",
  appId: "1:162525715048:web:da6ff60f8a8c4dd88079dd",
  storageBucket: "my-to-do-list-5a938.firebasestorage.app",
  apiKey: "AIzaSyCzH37zBO-VFKmduwO_cF3810vWXAG6S-M",
  authDomain: "my-to-do-list-5a938.firebaseapp.com",
  messagingSenderId: "162525715048"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
export const db = getFirestore(app);

export {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove
};
