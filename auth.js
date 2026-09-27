/* =====================================================
   ALORA FIREBASE AUTHENTICATION
   CUSTOMERS: Google Sign-In Only
   ADMIN: Email + Password
===================================================== */

import {
    auth,
    db
} from "./firebase.js";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ALORA_ADMIN_EMAIL = "alorajewels26@gmail.com";

/* =====================================================
   ADMIN AUTHORIZATION & ROLE HELPERS
===================================================== */

async function checkIsAuthorizedAdmin(user) {
    function extractNormalizedRole(data) {
        if (!data) return "";
        const raw = data.role !== undefined ? data.role : data.Role;
        if (typeof raw === "string") return raw.trim().toLowerCase();
        if (data.isAdmin === true || data.isAdmin === "true" || data.isAdmin === "admin") return "admin";
        if (data.admin === true || data.admin === "true") return "admin";
        if (raw === true) return "admin";
        if (Array.isArray(data.roles) && data.roles.some(r => typeof r === "string" && r.trim().toLowerCase() === "admin")) return "admin";
        if (data.roles && typeof data.roles === "object" && data.roles.admin === true) return "admin";
        if (typeof data.type === "string" && data.type.trim().toLowerCase() === "admin") return "admin";
        if (typeof data.accountType === "string" && data.accountType.trim().toLowerCase() === "admin") return "admin";
        return "";
    }
    if (!user || !user.email) {
        return {
            isAdmin: false,
            email: "",
            uid: user ? user.uid : null,
            role: null,
            normalizedRole: "",
            docExists: false,
            matchedPath: null
        };
    }

    const email = user.email.trim().toLowerCase();
    const isEmailMatch = email === ALORA_ADMIN_EMAIL.toLowerCase();

    if (!isEmailMatch) {
        return {
            isAdmin: false,
            email,
            uid: user.uid,
            role: null,
            normalizedRole: "",
            docExists: false,
            matchedPath: null
        };
    }

    try {
        if (typeof getDoc !== "function") {
            return {
                isAdmin: false,
                email,
                uid: user.uid,
                role: null,
                normalizedRole: "",
                docExists: false,
                matchedPath: null
            };
        }

        let matchedDoc = null;
        let matchedPath = `users/${user.uid}`;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap && typeof userSnap.exists === "function" && userSnap.exists()) {
            matchedDoc = userSnap;
        } else {
            try {
                const emailRef = doc(db, "users", email);
                const emailSnap = await getDoc(emailRef);
                if (emailSnap && typeof emailSnap.exists === "function" && emailSnap.exists()) {
                    matchedDoc = emailSnap;
                    matchedPath = `users/${email}`;
                }
            } catch (_) {}

            if (!matchedDoc) {
                try {
                    const adminUidRef = doc(db, "admins", user.uid);
                    const adminUidSnap = await getDoc(adminUidRef);
                    if (adminUidSnap && typeof adminUidSnap.exists === "function" && adminUidSnap.exists()) {
                        matchedDoc = adminUidSnap;
                        matchedPath = `admins/${user.uid}`;
                    }
                } catch (_) {}
            }

            if (!matchedDoc) {
                try {
                    const adminEmailRef = doc(db, "admins", email);
                    const adminEmailSnap = await getDoc(adminEmailRef);
                    if (adminEmailSnap && typeof adminEmailSnap.exists === "function" && adminEmailSnap.exists()) {
                        matchedDoc = adminEmailSnap;
                        matchedPath = `admins/${email}`;
                    }
                } catch (_) {}
            }
        }

        const exists = Boolean(matchedDoc && typeof matchedDoc.exists === "function" && matchedDoc.exists());
        const data = exists ? (matchedDoc.data() || {}) : {};
        const rawRole = data.role !== undefined ? data.role : data.Role;
        const normalizedRole = extractNormalizedRole(data);
        const isAdmin = exists && normalizedRole === "admin";

        return {
            isAdmin,
            email,
            uid: user.uid,
            role: rawRole !== undefined ? rawRole : null,
            normalizedRole,
            docExists: exists,
            matchedPath: exists ? matchedPath : null
        };
    } catch (err) {
        console.error("[ALORA AUTH DEBUG] Admin verification error:", err);
        return {
            isAdmin: false,
            email,
            uid: user.uid,
            role: null,
            normalizedRole: "",
            docExists: false,
            matchedPath: null,
            error: err.message
        };
    }
}

function getAdminTargetUrl() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrlParam = urlParams.get("returnUrl");
        if (returnUrlParam && returnUrlParam.toLowerCase().includes("admin.html")) {
            return returnUrlParam;
        }

        const orderId = urlParams.get("orderId");
        const userId = urlParams.get("userId");
        if (orderId || userId) {
            const adminUrl = new URL("admin.html", window.location.href);
            adminUrl.search = "";
            if (orderId) adminUrl.searchParams.set("orderId", orderId);
            if (userId) adminUrl.searchParams.set("userId", userId);
            return adminUrl.toString();
        }
    } catch (_) {}

    try {
        const stored = sessionStorage.getItem("aloraReturnUrl");
        if (stored && stored.toLowerCase().includes("admin.html")) {
            return stored;
        }
    } catch (_) {}

    return "admin.html";
}
window.getAdminTargetUrl = getAdminTargetUrl;

/* =====================================================
   DOM ELEMENTS
===================================================== */

const loginSection = document.getElementById("loginSection");
const registerSection = document.getElementById("registerSection");
const adminLoginSection = document.getElementById("adminLoginSection");

const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");
const adminLoginMessage = document.getElementById("adminLoginMessage");

const googleLoginBtn = document.getElementById("googleLoginBtn");
const googleRegisterBtn = document.getElementById("googleRegisterBtn");
const registerTermsConsent = document.getElementById("registerTermsConsent");

const adminLoginForm = document.getElementById("adminLoginForm");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const resendVerificationContainer = document.getElementById("resendVerificationContainer");
const resendVerificationBtn = document.getElementById("resendVerificationBtn");
let passwordResetInFlight = false;

/* =====================================================
   VIEW SWITCHING
===================================================== */

window.showRegister = function () {
    if (loginSection) loginSection.hidden = true;
    if (adminLoginSection) adminLoginSection.hidden = true;
    if (registerSection) registerSection.hidden = false;
    clearMessages();
};

window.showLogin = function () {
    if (registerSection) registerSection.hidden = true;
    if (adminLoginSection) adminLoginSection.hidden = true;
    if (loginSection) loginSection.hidden = false;
    clearMessages();
};

window.showAdminLogin = function () {
    if (loginSection) loginSection.hidden = true;
    if (registerSection) registerSection.hidden = true;
    if (adminLoginSection) {
        adminLoginSection.hidden = false;
        const pwdInput = document.getElementById("adminLoginPassword");
        if (pwdInput && typeof pwdInput.focus === "function") pwdInput.focus();
    }
    clearMessages();
};

/* =====================================================
   SHOW / HIDE PASSWORD (ADMIN)
===================================================== */

window.togglePassword = function (inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const showPassword = input.type === "password";
    input.type = showPassword ? "text" : "password";
    if (button) {
        button.setAttribute(
            "aria-label",
            showPassword ? "Hide password" : "Show password"
        );
    }
};

/* =====================================================
   GOOGLE AUTHENTICATION (POPUP)
===================================================== */

async function handleGoogleSignIn(mode = "login") {
    clearMessages();
    const isSignup = mode === "signup" || (registerSection && !registerSection.hidden);
    const activeMessageEl = isSignup ? registerMessage : loginMessage;
    const activeBtn = isSignup ? googleRegisterBtn : googleLoginBtn;

    // Required consent validation ONLY for customer sign-up
    if (isSignup) {
        const consentCheckbox = document.getElementById("registerTermsConsent");
        if (consentCheckbox && !consentCheckbox.checked) {
            showMessage(
                activeMessageEl,
                "Please agree to the Terms & Conditions and Privacy Policy to continue."
            );
            return;
        }
    }

    if (activeBtn) {
        activeBtn.disabled = true;
    }

    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: "select_account"
        });

        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        if (!user) return;

        // Ensure minimal user document exists in Firestore ONLY if not already present
        // PRESERVE EXISTING PROFILE DATA IF DOCUMENT EXISTS!
        if (user && user.uid) {
            try {
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap || !userSnap.exists()) {
                    await setDoc(userRef, {
                        name: user.displayName || "Customer",
                        email: user.email || "",
                        phone: user.phoneNumber || "",
                        address: "",
                        authProvider: "google",
                        createdAt: new Date().toISOString()
                    });
                }
            } catch (firestoreErr) {
                console.warn("[ALORA AUTH] Firestore customer profile check warning:", firestoreErr);
            }
        }

        // Admin check safeguard
        const adminCheck = await checkIsAuthorizedAdmin(user);
        if (adminCheck.isAdmin || (adminCheck.email && adminCheck.email === ALORA_ADMIN_EMAIL.toLowerCase())) {
            sessionStorage.removeItem("aloraReturnUrl");
            window.location.replace(getAdminTargetUrl());
            return;
        }

        // Customer redirect determination (preserve returnUrl / order flow)
        let returnUrl = "";
        try {
            const urlParams = new URLSearchParams(window.location.search);
            returnUrl = urlParams.get("returnUrl") || sessionStorage.getItem("aloraReturnUrl");
        } catch (_) {}

        const targetUrl = (returnUrl && !returnUrl.toLowerCase().includes("admin.html"))
            ? returnUrl
            : "profile.html";

        sessionStorage.removeItem("aloraReturnUrl");

        showMessage(
            activeMessageEl,
            isSignup ? "Account created successfully! Redirecting..." : "Sign-in successful! Redirecting...",
            true
        );

        setTimeout(() => {
            window.location.href = targetUrl;
        }, 400);

    } catch (error) {
        console.error("[ALORA AUTH] Google sign-in error:", error);

        if (
            error.code === "auth/popup-closed-by-user" ||
            error.code === "auth/cancelled-popup-request"
        ) {
            // User intentionally closed the popup; do not display error
            return;
        }

        let userMsg = "Google sign-in could not be completed. Please try again.";
        if (error.code === "auth/popup-blocked") {
            userMsg = "Sign-in popup was blocked by your browser. Please allow popups for this site and try again.";
        } else if (error.code === "auth/unauthorized-domain") {
            userMsg = "This domain is not authorized for Google Sign-In in Firebase Console.";
        } else if (error.code === "auth/operation-not-allowed") {
            userMsg = "Google Sign-In is not enabled. Please enable Google provider in Firebase Console.";
        } else if (error.code === "auth/account-exists-with-different-credential") {
            userMsg = "An account already exists with a different credential.";
        } else if (error.code === "auth/network-request-failed") {
            userMsg = "Network error. Please check your internet connection.";
        } else if (error.code) {
            userMsg = getAuthErrorMessage(error.code) || userMsg;
        }

        showMessage(activeMessageEl, userMsg);
    } finally {
        if (activeBtn) {
            activeBtn.disabled = false;
        }
    }
}

if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", () => handleGoogleSignIn("login"));
}

if (googleRegisterBtn) {
    googleRegisterBtn.addEventListener("click", () => handleGoogleSignIn("signup"));
}

if (registerTermsConsent) {
    registerTermsConsent.addEventListener("change", function () {
        if (this.checked && registerMessage) {
            clearMessages();
        }
    });
}

/* =====================================================
   STORE ADMINISTRATOR LOGIN (EMAIL + PASSWORD)
===================================================== */

if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessages();

        const emailInput = document.getElementById("adminLoginEmail");
        const passwordInput = document.getElementById("adminLoginPassword");
        const adminMsg = adminLoginMessage || loginMessage;
        const submitBtn = document.getElementById("adminLoginSubmitBtn");

        const email = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

        if (!email) {
            showMessage(adminMsg, "Please enter admin email address.");
            return;
        }

        if (!password) {
            showMessage(adminMsg, "Please enter admin password.");
            return;
        }

        setLoading(submitBtn, true, "Logging In...");

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const adminCheck = await checkIsAuthorizedAdmin(user);
            const adminTarget = getAdminTargetUrl();

            if (adminCheck.isAdmin || (adminCheck.email && adminCheck.email === ALORA_ADMIN_EMAIL.toLowerCase())) {
                showMessage(adminMsg, "Admin login successful. Redirecting...", true);
                sessionStorage.removeItem("aloraReturnUrl");
                setTimeout(() => {
                    window.location.replace(adminTarget);
                }, 300);
                return;
            }

            // Non-admin credential entered in admin portal
            showMessage(adminMsg, "Access denied. Store administrator access only.");
            if (typeof auth.signOut === "function") {
                await auth.signOut();
            }
            setLoading(submitBtn, false, "Login to Dashboard");
        } catch (error) {
            showMessage(adminMsg, getAuthErrorMessage(error.code));
            setLoading(submitBtn, false, "Login to Dashboard");
        }
    });
}

/* =====================================================
   LEGACY / TEST HARNESS COMPATIBILITY HANDLERS
===================================================== */

if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener("click", async function () {
        if (passwordResetInFlight) return;

        const emailInput = document.getElementById("loginEmail");
        const email = emailInput ? emailInput.value.trim() : "";

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showMessage(loginMessage, "Enter a valid email address.");
            return;
        }

        passwordResetInFlight = true;
        forgotPasswordButton.disabled = true;
        forgotPasswordButton.textContent = "Sending...";

        try {
            await sendPasswordResetEmail(auth, email);
            showMessage(
                loginMessage,
                "If an account exists for this email, you will receive a password reset link. Check your inbox and spam folder.",
                true
            );
        } catch (error) {
            let message = "We couldn't send the password reset email. Please try again.";
            if (error.code === "auth/invalid-email") {
                message = "Enter a valid email address.";
            } else if (error.code === "auth/too-many-requests") {
                message = "Too many reset attempts. Please try again later.";
            } else if (error.code === "auth/network-request-failed") {
                message = "Network error. Check your connection and try again.";
            }
            showMessage(loginMessage, message);
        } finally {
            passwordResetInFlight = false;
            forgotPasswordButton.disabled = false;
            forgotPasswordButton.textContent = "Forgot Password?";
        }
    });
}

if (resendVerificationBtn) {
    resendVerificationBtn.addEventListener("click", async function () {
        showMessage(loginMessage, "Please sign in with Google to access your account.");
    });
}

/* =====================================================
   HELPERS & ERROR MESSAGES
===================================================== */

function showMessage(element, message, success = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("success", success);
}

function clearMessages() {
    const messageElements = [
        loginMessage,
        registerMessage,
        adminLoginMessage
    ];
    messageElements.forEach(el => {
        if (el) {
            el.textContent = "";
            el.classList.remove("success");
        }
    });
    if (resendVerificationContainer) {
        resendVerificationContainer.style.display = "none";
    }
}

function setLoading(button, loading, text) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = text;
}

function getAuthErrorMessage(code) {
    switch (code) {
        case "auth/invalid-email":
            return "Enter a valid email address.";
        case "auth/invalid-credential":
            return "Incorrect credentials. Please try again.";
        case "auth/wrong-password":
            return "Incorrect password. Please try again.";
        case "auth/user-not-found":
            return "No account found with this email.";
        case "auth/user-disabled":
            return "This account has been disabled. Please contact support.";
        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";
        case "auth/network-request-failed":
            return "Check your internet connection.";
        case "auth/popup-blocked":
            return "Sign-in popup was blocked by your browser. Please allow popups for this site.";
        case "auth/unauthorized-domain":
            return "This domain is not authorized for sign-in in Firebase Console.";
        case "auth/operation-not-allowed":
            return "This sign-in method is not enabled in Firebase Console.";
        case "auth/account-exists-with-different-credential":
            return "An account already exists with a different credential.";
        default:
            return "Something went wrong. Please try again.";
    }
}

/* =====================================================
   AUTH STATE CHANGE LISTENER
===================================================== */

if (typeof onAuthStateChanged === "function") {
    onAuthStateChanged(auth, async function (user) {
        if (!user) return;

        const adminCheck = await checkIsAuthorizedAdmin(user);
        if (adminCheck.isAdmin || (adminCheck.email && adminCheck.email === ALORA_ADMIN_EMAIL.toLowerCase())) {
            const adminTarget = getAdminTargetUrl();
            console.log("[ALORA AUTH DEBUG]", {
                currentPage: "login.html",
                file: "auth.js",
                function: "onAuthStateChanged",
                email: adminCheck.email,
                uid: adminCheck.uid,
                docExists: adminCheck.docExists,
                firestoreRole: adminCheck.role !== undefined && adminCheck.role !== null ? adminCheck.role : "(undefined)",
                normalizedRole: adminCheck.normalizedRole,
                chosenRedirectTarget: adminTarget
            });
            sessionStorage.removeItem("aloraReturnUrl");
            window.location.replace(adminTarget);
        }
    });
}

/* =====================================================
   URL ROUTE INITIALIZATION
===================================================== */

function initAuthViewFromUrl() {
    try {
        const hash = window.location.hash;
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get("mode");

        if (hash === "#register" || mode === "register") {
            window.showRegister();
        } else if (hash === "#admin" || mode === "admin") {
            window.showAdminLogin();
        } else {
            window.showLogin();
        }
    } catch (_) {
        window.showLogin();
    }
}

initAuthViewFromUrl();