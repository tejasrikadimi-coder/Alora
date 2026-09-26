/* =====================================================
   ALORA FIREBASE CONFIGURATION
===================================================== */


/* FIREBASE APP */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";


/* FIREBASE AUTHENTICATION */

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


/* FIREBASE FIRESTORE */

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* FIREBASE ANALYTICS */

import {
    getAnalytics,
    isSupported
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";


/* FIREBASE CONFIG */

const firebaseConfig = {
    apiKey:
        "AIzaSyAX5cyNmGFgvIehLF1GGboJvP9prFteHIo",

    authDomain:
        "alora-handmade-jewelry.firebaseapp.com",

    projectId:
        "alora-handmade-jewelry",

    storageBucket:
        "alora-handmade-jewelry.firebasestorage.app",

    messagingSenderId:
        "282160785011",

    appId:
        "1:282160785011:web:c24b3047635faef9d1ac06",

    measurementId:
        "G-4FDTV3W3Y6"
};


/* INITIALIZE FIREBASE */

const app =
    initializeApp(firebaseConfig);


/* INITIALIZE AUTHENTICATION */

const auth =
    getAuth(app);


/* INITIALIZE FIRESTORE */

const db =
    getFirestore(app);


/* INITIALIZE ANALYTICS SAFELY */

let analytics = null;
let analyticsInitAttempted = false;

async function initAnalytics() {
    if (analytics) {
        return analytics;
    }

    try {
        const measurementId =
            (typeof window !== "undefined" && window.ALORA_ANALYTICS_CONFIG && window.ALORA_ANALYTICS_CONFIG.measurementId) ||
            firebaseConfig.measurementId;

        if (!measurementId) {
            if (!analyticsInitAttempted) {
                analyticsInitAttempted = true;
                console.warn(
                    "[Alora Analytics] No measurementId found in Firebase config or window.ALORA_ANALYTICS_CONFIG.\n" +
                    "Google Analytics page tracking is inactive until a Measurement ID (format: G-XXXXXXXXXX) is added.\n" +
                    "To enable:\n" +
                    "1. Go to Firebase Console -> Project Settings -> General -> Your apps -> Web app.\n" +
                    "2. Copy the 'measurementId' (e.g. 'G-XXXXXXXXXX').\n" +
                    "3. Add measurementId: 'G-XXXXXXXXXX' to firebaseConfig in firebase.js."
                );
            }
            return null;
        }

        const supported = await isSupported();
        if (!supported) {
            console.info("[Alora Analytics] Firebase Analytics is not supported in this browser environment.");
            return null;
        }

        if (!app.options.measurementId) {
            app.options.measurementId = measurementId;
        }

        analytics = getAnalytics(app);
        return analytics;
    } catch (error) {
        console.warn("[Alora Analytics] Analytics initialization failed:", error.message);
        return null;
    }
}


/* EXPORT */

export {
    app,
    auth,
    db,
    initAnalytics,
    analytics
};