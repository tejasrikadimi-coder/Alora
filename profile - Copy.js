/* =====================================================
   ALORA CUSTOMER PROFILE
===================================================== */

import {
    auth,
    db
} from "./firebase.js";


import {
    onAuthStateChanged,
    updateProfile,
    signOut,
    deleteUser
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {
    doc,
    getDoc,
    setDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =====================================================
   ELEMENTS
===================================================== */

const profileForm =
    document.getElementById("profileForm");

const profileName =
    document.getElementById("profileName");

const profilePhone =
    document.getElementById("profilePhone");

const profileEmail =
    document.getElementById("profileEmail");

const profileAddress =
    document.getElementById("profileAddress");

const profileDisplayName =
    document.getElementById("profileDisplayName");

const profileDisplayEmail =
    document.getElementById("profileDisplayEmail");

const profileAvatar =
    document.getElementById("profileAvatar");

const profileMessage =
    document.getElementById("profileMessage");

const logoutButton =
    document.getElementById("logoutButton");


let currentUser = null;


/* =====================================================
   CHECK LOGIN
===================================================== */

onAuthStateChanged(
    auth,
    async function (user) {
        if (!user) {
            window.location.href =
                "login.html";

            return;
        }

        currentUser = user;

        await loadProfile(user);
    }
);


/* =====================================================
   LOAD PROFILE
===================================================== */

async function loadProfile(user) {
    profileDisplayName.textContent =
        user.displayName || "Alora Customer";

    profileDisplayEmail.textContent =
        user.email || "";

    profileEmail.value =
        user.email || "";

    profileName.value =
        user.displayName || "";

    profileAvatar.textContent =
        (
            user.displayName ||
            user.email ||
            "A"
        )
            .charAt(0)
            .toUpperCase();


    try {
        const userEmail = (user.email || "").trim().toLowerCase();
        const isAuthorizedEmail = userEmail === "alorajewels26@gmail.com";

        const profileReference =
            doc(db, "users", user.uid);

        let profileSnapshot =
            await getDoc(profileReference);

        let matchedDoc =
            (profileSnapshot && typeof profileSnapshot.exists === "function" && profileSnapshot.exists())
                ? profileSnapshot
                : null;

        if (!matchedDoc && isAuthorizedEmail) {
            try {
                const emailRef = doc(db, "users", userEmail);
                const emailSnap = await getDoc(emailRef);
                if (emailSnap && typeof emailSnap.exists === "function" && emailSnap.exists()) {
                    matchedDoc = emailSnap;
                }
            } catch (_) {}

            if (!matchedDoc) {
                try {
                    const adminUidRef = doc(db, "admins", user.uid);
                    const adminUidSnap = await getDoc(adminUidRef);
                    if (adminUidSnap && typeof adminUidSnap.exists === "function" && adminUidSnap.exists()) {
                        matchedDoc = adminUidSnap;
                    }
                } catch (_) {}
            }

            if (!matchedDoc) {
                try {
                    const adminEmailRef = doc(db, "admins", userEmail);
                    const adminEmailSnap = await getDoc(adminEmailRef);
                    if (adminEmailSnap && typeof adminEmailSnap.exists === "function" && adminEmailSnap.exists()) {
                        matchedDoc = adminEmailSnap;
                    }
                } catch (_) {}
            }
        }

        const docExists = Boolean(matchedDoc && typeof matchedDoc.exists === "function" && matchedDoc.exists());
        const data = docExists ? (matchedDoc.data() || {}) : {};
        const rawRole = data.role !== undefined ? data.role : data.Role;

        function extractRole(d) {
            if (!d) return "";
            const raw = d.role !== undefined ? d.role : d.Role;
            if (typeof raw === "string") return raw.trim().toLowerCase();
            if (d.isAdmin === true || d.isAdmin === "true" || d.isAdmin === "admin") return "admin";
            if (d.admin === true || d.admin === "true") return "admin";
            if (raw === true) return "admin";
            if (Array.isArray(d.roles) && d.roles.some(r => typeof r === "string" && r.trim().toLowerCase() === "admin")) return "admin";
            if (d.roles && typeof d.roles === "object" && d.roles.admin === true) return "admin";
            if (typeof d.type === "string" && d.type.trim().toLowerCase() === "admin") return "admin";
            if (typeof d.accountType === "string" && d.accountType.trim().toLowerCase() === "admin") return "admin";
            return "";
        }

        const normalizedRole = extractRole(data);
        const isRoleAdmin = docExists && normalizedRole === "admin";

        if (isAuthorizedEmail) {
            console.log(
                "[ALORA AUTH DEBUG]",
                {
                    currentPage: "profile.html",
                    file: "profile.js",
                    function: "loadProfile",
                    email: user.email,
                    uid: user.uid,
                    docExists,
                    firestoreRole: rawRole !== undefined && rawRole !== null ? rawRole : "(undefined)",
                    normalizedRole,
                    chosenRedirectTarget: "admin.html"
                }
            );
            sessionStorage.removeItem("aloraReturnUrl");
            window.location.replace("admin.html");
            return;
        }

        if (docExists) {


            profileName.value =
                data.name ||
                user.displayName ||
                "";


            profilePhone.value =
                data.phone || "";

            profileAddress.value =
                data.address || "";

            updateProfileHeading(
                profileName.value,
                user.email
            );
        }

    } catch (error) {
        showProfileMessage(
            "Unable to load profile details."
        );
    }
}


/* =====================================================
   SAVE PROFILE
===================================================== */

profileForm.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        if (!currentUser) {
            return;
        }

        const name =
            profileName.value.trim();

        const phone =
            profilePhone.value.trim();

        const address =
            profileAddress.value.trim();

        const saveButton =
            profileForm.querySelector(
                ".profile-save"
            );


        if (name === "") {
            showProfileMessage(
                "Please enter your name."
            );

            return;
        }


        if (!/^[0-9]{10}$/.test(phone)) {
            showProfileMessage(
                "Enter a valid 10-digit phone number."
            );

            return;
        }


        saveButton.disabled = true;

        saveButton.textContent =
            "Saving Changes...";


        try {
            await updateProfile(
                currentUser,
                {
                    displayName: name
                }
            );


            await setDoc(
                doc(
                    db,
                    "users",
                    currentUser.uid
                ),
                {
                    name: name,

                    email:
                        currentUser.email,

                    phone: phone,

                    address: address,

                    updatedAt:
                        new Date().toISOString()
                },
                {
                    merge: true
                }
            );


            updateProfileHeading(
                name,
                currentUser.email
            );


            showProfileMessage(
                "Profile updated successfully.",
                true
            );

        } catch (error) {
            showProfileMessage(
                "Unable to update profile. Please try again."
            );
        }


        saveButton.disabled = false;

        saveButton.textContent =
            "Save Changes";
    }
);


/* =====================================================
   UPDATE PROFILE DISPLAY
===================================================== */

function updateProfileHeading(
    name,
    email
) {
    profileDisplayName.textContent =
        name || "Alora Customer";

    profileDisplayEmail.textContent =
        email || "";

    profileAvatar.textContent =
        (name || email || "A")
            .charAt(0)
            .toUpperCase();
}


/* =====================================================
   PROFILE MESSAGE
===================================================== */

function showProfileMessage(
    message,
    success = false
) {
    profileMessage.textContent =
        message;

    profileMessage.classList.toggle(
        "success",
        success
    );
}


/* =====================================================
   LOGOUT
===================================================== */

logoutButton.addEventListener(
    "click",
    async function () {
        if (
            !window.confirm(
                "Are you sure you want to log out?"
            )
        ) {
            return;
        }

        logoutButton.disabled = true;

        logoutButton.textContent =
            "Logging Out...";


        try {
            await signOut(auth);

            window.location.href =
                "login.html";

        } catch (error) {
            logoutButton.disabled = false;

            logoutButton.textContent =
                "Logout";

           const returnURL =
    sessionStorage.getItem(
        "aloraReturnUrl"
    );

if (returnURL) {
    sessionStorage.removeItem(
        "aloraReturnUrl"
    );

    setTimeout(function () {
        window.location.href =
            returnURL;
    }, 1000);
}
        }
    }
);


/* =====================================================
   DELETE ACCOUNT (GDPR / PRIVACY RIGHTS)
===================================================== */

const deleteAccountBtn = document.getElementById("deleteAccountBtn");
if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", async function () {
        if (!currentUser) return;

        const email = (currentUser.email || "").toLowerCase().trim();
        if (email === "alorajewels26@gmail.com") {
            alert("The primary administrator account cannot be deleted.");
            return;
        }

        const confirmFirst = confirm("Warning: Deleting your account will permanently remove your profile, address, and saved details from Alora.\n\nAre you sure you want to proceed?");
        if (!confirmFirst) return;

        const confirmWord = prompt("To confirm deletion, please type DELETE below:");
        if (confirmWord !== "DELETE") {
            alert("Deletion cancelled. The confirmation text did not match.");
            return;
        }

        deleteAccountBtn.disabled = true;
        deleteAccountBtn.textContent = "Deleting Account...";

        try {
            // Delete Firestore user profile document
            await deleteDoc(doc(db, "users", currentUser.uid));

            // Delete Auth account
            await deleteUser(currentUser);

            // Clear local guest storage
            localStorage.removeItem("aloraWishlist");
            localStorage.removeItem("aloraCart");
            sessionStorage.removeItem("aloraReturnUrl");

            alert("Your account and associated profile data have been permanently deleted. Thank you for being a part of Alora.");
            window.location.href = "index.html";
        } catch (error) {
            console.error("Account deletion failed:", error);
            if (error.code === "auth/requires-recent-login") {
                alert("For security reasons, please log out and log back in, then retry deleting your account.");
            } else {
                alert("Account deletion failed: " + (error.message || "Please try again later."));
            }
            deleteAccountBtn.disabled = false;
            deleteAccountBtn.textContent = "Delete My Account";
        }
    });
}