import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { firebaseConfig } from "./firebase-local.js?v=3";

export const app = initializeApp(firebaseConfig);
