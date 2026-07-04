import { connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";

export const firebaseConfig = {
    apiKey: "AIzaSyCO6Y6Pa7b7zbieJIErysaNF6-UqbT8KJw",
    authDomain: "e-learning-942f7.firebaseapp.com",
    projectId: "e-learning-942f7",
    storageBucket: "e-learning-942f7.firebasestorage.app",
    messagingSenderId: "878397058574",
    appId: "1:878397058574:web:28aaa07a291ee3baab165f"
};

export function isLocalDev() {
    const host = window.location.hostname;
    return host === "127.0.0.1" || host === "localhost";
}

const connected = { auth: false, db: false, functions: false };

function resolveEmulatorHost() {
    return window.location.hostname || "127.0.0.1";
}

/** Connect Firebase client SDKs to local emulators (no-op in production). */
export function connectFirebaseEmulators({ auth, db, functions } = {}) {
    if (!isLocalDev()) return;
    const emulatorHost = resolveEmulatorHost();
    if (auth && !connected.auth) {
        connected.auth = true;
        connectAuthEmulator(auth, `http://${emulatorHost}:19099`, { disableWarnings: true });
    }
    if (db && !connected.db) {
        connected.db = true;
        connectFirestoreEmulator(db, emulatorHost, 18080);
    }
    if (functions && !connected.functions) {
        connected.functions = true;
        connectFunctionsEmulator(functions, emulatorHost, 15001);
    }
}
