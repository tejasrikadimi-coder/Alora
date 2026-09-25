/* =====================================================
   ALORA FIREBASE AUTHENTICATION
===================================================== */

import {
    auth,
    db
} from "./firebase.js";


import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ALORA_ADMIN_EMAIL = "alorajewels26@gmail.com";

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
            console.warn("[ALORA AUTH DEBUG] getDoc is unavailable in auth.js");
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

        // 1. Primary check: doc(db, "users", user.uid)
        let matchedDoc = null;
        let matchedPath = `users/${user.uid}`;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap && typeof userSnap.exists === "function" && userSnap.exists()) {
            matchedDoc = userSnap;
        } else {
            // Fallback checks if document was created with email ID or in admins collection
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

        console.log("[ALORA AUTH DEBUG]", {
            currentPage: "login.html",
            file: "auth.js",
            function: "checkIsAuthorizedAdmin",
            email,
            uid: user.uid,
            docExists: exists,
            firestoreRole: rawRole !== undefined ? rawRole : "(undefined)",
            normalizedRole,
            chosenRedirectTarget: isAdmin ? "admin.html" : "none (evaluating)"
        });

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





/* =====================================================
   ELEMENTS
===================================================== */

const loginSection =
    document.getElementById("loginSection");

const registerSection =
    document.getElementById("registerSection");

const loginForm =
    document.getElementById("loginForm");

const registerForm =
    document.getElementById("registerForm");

const loginMessage =
    document.getElementById("loginMessage");

const registerMessage =
    document.getElementById("registerMessage");

const forgotPasswordButton =
    document.getElementById(
        "forgotPasswordButton"
    );

let passwordResetInFlight = false;


/* =====================================================
   SHOW LOGIN / REGISTER
===================================================== */

window.showRegister = function () {
    loginSection.hidden = true;
    registerSection.hidden = false;

    clearMessages();
};


window.showLogin = function () {
    registerSection.hidden = true;
    loginSection.hidden = false;

    clearMessages();
};


/* =====================================================
   SHOW / HIDE PASSWORD
===================================================== */

window.togglePassword = function (
    inputId,
    button
) {
    const input =
        document.getElementById(inputId);

    if (!input) {
        return;
    }

    const showPassword =
        input.type === "password";

    input.type =
        showPassword ? "text" : "password";

    button.setAttribute(
        "aria-label",
        showPassword
            ? "Hide password"
            : "Show password"
    );
};


/* =====================================================
   REGISTER
===================================================== */

registerForm.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        clearMessages();


        const name =
            document
                .getElementById("registerName")
                .value
                .trim();

        const email =
            document
                .getElementById("registerEmail")
                .value
                .trim();

        const phone =
            document
                .getElementById("registerPhone")
                .value
                .trim();

        const password =
            document
                .getElementById("registerPassword")
                .value;

        const confirmPassword =
            document
                .getElementById("confirmPassword")
                .value;

        const submitButton =
            registerForm.querySelector(
                ".auth-submit"
            );


        /* VALIDATION */

        if (!/^[0-9]{10}$/.test(phone)) {
            showMessage(
                registerMessage,
                "Enter a valid 10-digit phone number."
            );

            return;
        }


        if (password.length < 6) {
            showMessage(
                registerMessage,
                "Password must contain at least 6 characters."
            );

            return;
        }


        if (password !== confirmPassword) {
            showMessage(
                registerMessage,
                "Passwords do not match."
            );

            return;
        }


        setLoading(
            submitButton,
            true,
            "Creating Account..."
        );


        try {
            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const user =
                userCredential.user;


            /* SAVE DISPLAY NAME */

            await updateProfile(user, {
                displayName: name
            });


            /* SAVE PROFILE IN FIRESTORE */

            await setDoc(
                doc(db, "users", user.uid),
                {
                    name: name,
                    email: email,
                    phone: phone,
                    address: "",
                    createdAt:
                        new Date().toISOString()
                }
            );


            showMessage(
                registerMessage,
                "Account created successfully.",
                true
            );


            setTimeout(function () {
    const returnURL =
        sessionStorage.getItem(
            "aloraReturnUrl"
        );

    if (returnURL) {
        window.location.href =
            returnURL;
    } else {
        window.location.href =
            "profile.html";
    }
}, 800);
        } catch (error) {
            showMessage(
                registerMessage,
                getAuthErrorMessage(error.code)
            );

            setLoading(
                submitButton,
                false,
                "Create Account"
            );
        }
    }
);


/* =====================================================
   LOGIN
===================================================== */

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

loginForm.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        clearMessages();


        const email =
            document
                .getElementById("loginEmail")
                .value
                .trim();

        const password =
            document
                .getElementById("loginPassword")
                .value;

        const submitButton =
            loginForm.querySelector(
                ".auth-submit"
            );


        setLoading(
            submitButton,
            true,
            "Logging In..."
        );


        try {
            const userCredential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const user = userCredential.user;
            const adminCheck =
                await checkIsAuthorizedAdmin(user);

            showMessage(
                loginMessage,
                "Login successful.",
                true
            );

            const adminTarget = getAdminTargetUrl();

            if (adminCheck.isAdmin) {
                console.log("[ALORA AUTH DEBUG]", {
                    currentPage: "login.html",
                    file: "auth.js",
                    function: "loginForm.submit",
                    email: adminCheck.email,
                    uid: adminCheck.uid,
                    docExists: adminCheck.docExists,
                    firestoreRole: adminCheck.role !== undefined && adminCheck.role !== null ? adminCheck.role : "(undefined)",
                    normalizedRole: adminCheck.normalizedRole,
                    chosenRedirectTarget: adminTarget
                });

                sessionStorage.removeItem("aloraReturnUrl");
                window.location.replace(adminTarget);
                return;
            }

            // CRITICAL SAFEGUARD:
            // If the user's email is the authorized admin email, NEVER redirect to customer storefront
            if (
                adminCheck.email ===
                ALORA_ADMIN_EMAIL.toLowerCase()
            ) {
                console.log(
                    "[ALORA AUTH DEBUG]",
                    {
                        currentPage: "login.html",
                        file: "auth.js",
                        function: "loginForm.submit",
                        email: adminCheck.email,
                        uid: adminCheck.uid,
                        docExists: adminCheck.docExists,
                        firestoreRole: adminCheck.role !== undefined && adminCheck.role !== null ? adminCheck.role : "(undefined)",
                        normalizedRole: adminCheck.normalizedRole,
                        chosenRedirectTarget: adminTarget
                    }
                );

                sessionStorage.removeItem("aloraReturnUrl");
                window.location.replace(adminTarget);
                return;
            }

            const returnUrl =
                sessionStorage.getItem(
                    "aloraReturnUrl"
                );

            const targetUrl =
                returnUrl &&
                !returnUrl
                    .toLowerCase()
                    .includes("admin.html")
                    ? returnUrl
                    : "profile.html";

            sessionStorage.removeItem(
                "aloraReturnUrl"
            );

            console.log(
                "[ALORA AUTH DEBUG]",
                {
                    currentPage: "login.html",
                    file: "auth.js",
                    function: "loginForm.submit",
                    email: user.email,
                    uid: user.uid,
                    docExists: adminCheck.docExists,
                    firestoreRole:
                        adminCheck.role ||
                        "customer",
                    normalizedRole: adminCheck.normalizedRole || "customer",
                    chosenRedirectTarget: targetUrl
                }
            );

            setTimeout(function () {
                window.location.href =
                    targetUrl;
            }, 400);

        } catch (error) {

            showMessage(
                loginMessage,
                getAuthErrorMessage(error.code)
            );

            setLoading(
                submitButton,
                false,
                "Login"
            );
        }
    }
);

forgotPasswordButton.addEventListener(
    "click",
    async function () {
        if (passwordResetInFlight) {
            return;
        }

        const email =
            document
                .getElementById("loginEmail")
                .value
                .trim();

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email
            )
        ) {
            showMessage(
                loginMessage,
                "Enter a valid email address."
            );
            return;
        }

        passwordResetInFlight = true;
        forgotPasswordButton.disabled = true;
        forgotPasswordButton.textContent =
            "Sending...";

        try {
            await sendPasswordResetEmail(
                auth,
                email
            );

            showMessage(
                loginMessage,
                "If an account exists for this email, you will receive a password reset link. Check your inbox and spam folder.",
                true
            );
        } catch (error) {
            let message =
                "We couldn't send the password reset email. Please try again.";

            if (
                error.code ===
                "auth/invalid-email"
            ) {
                message =
                    "Enter a valid email address.";
            } else if (
                error.code ===
                "auth/too-many-requests"
            ) {
                message =
                    "Too many reset attempts. Please try again later.";
            } else if (
                error.code ===
                "auth/network-request-failed"
            ) {
                message =
                    "Network error. Check your connection and try again.";
            }

            showMessage(
                loginMessage,
                message
            );
        } finally {
            passwordResetInFlight = false;
            forgotPasswordButton.disabled =
                false;
            forgotPasswordButton.textContent =
                "Forgot Password?";
        }
    }
);


/* =====================================================
   HELPERS
===================================================== */

function showMessage(
    element,
    message,
    success = false
) {
    element.textContent = message;

    element.classList.toggle(
        "success",
        success
    );
}


function clearMessages() {
    loginMessage.textContent = "";
    registerMessage.textContent = "";

    loginMessage.classList.remove("success");
    registerMessage.classList.remove("success");
}


function setLoading(
    button,
    loading,
    text
) {
    button.disabled = loading;
    button.textContent = text;
}


function getAuthErrorMessage(code) {
    switch (code) {
        case "auth/email-already-in-use":
            return "An account already exists with this email.";

        case "auth/invalid-email":
            return "Enter a valid email address.";

        case "auth/weak-password":
            return "Please choose a stronger password.";

        case "auth/invalid-credential":
            return "Incorrect email or password.";

        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";

        case "auth/network-request-failed":
            return "Check your internet connection.";

        default:
            return "Something went wrong. Please try again.";
    }
}


if (typeof onAuthStateChanged === "function") {
    onAuthStateChanged(auth, async function (user) {
        if (!user) {
            return;
        }

        const adminCheck = await checkIsAuthorizedAdmin(user);
        if (adminCheck.isAdmin || (adminCheck.email && adminCheck.email === ALORA_ADMIN_EMAIL.toLowerCase())) {
            const adminTarget = getAdminTargetUrl();
            console.log(
                "[ALORA AUTH DEBUG]",
                {
                    currentPage: "login.html",
                    file: "auth.js",
                    function: "onAuthStateChanged",
                    email: adminCheck.email,
                    uid: adminCheck.uid,
                    docExists: adminCheck.docExists,
                    firestoreRole: adminCheck.role !== undefined && adminCheck.role !== null ? adminCheck.role : "(undefined)",
                    normalizedRole: adminCheck.normalizedRole,
                    chosenRedirectTarget: adminTarget
                }
            );
            sessionStorage.removeItem("aloraReturnUrl");
            window.location.replace(adminTarget);
        }
    });
}

