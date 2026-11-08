import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
