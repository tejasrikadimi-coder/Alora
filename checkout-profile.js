/* =====================================================
   ALORA CHECKOUT PROFILE
===================================================== */

import {
    auth,
    db
} from "./firebase.js";


import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

/* =====================================================
   ELEMENTS
===================================================== */

const checkoutLoading =
    document.getElementById("checkoutLoading");

const checkoutProfile =
    document.getElementById("checkoutProfile");

const missingAddress =
    document.getElementById("missingAddress");

const checkoutOrderDetails =
    document.getElementById("checkoutOrderDetails");

const placeOrderButton =
    document.getElementById("placeOrderButton");

const checkoutMessage =
    document.getElementById("checkoutMessage");


/* PROFILE DISPLAY */

const checkoutName =
    document.getElementById("checkoutName");

const checkoutPhone =
    document.getElementById("checkoutPhone");

const checkoutEmail =
    document.getElementById("checkoutEmail");

const checkoutAddress =
    document.getElementById("checkoutAddress");


/* HIDDEN FORM VALUES */

const customerNameInput =
    document.getElementById("customerName");

const phoneInput =
    document.getElementById("phone");

const emailInput =
    document.getElementById("email");

const addressInput =
    document.getElementById("address");


/* PROFILE LINKS */

const changeProfileLink =
    document.getElementById("changeProfileLink");

const addAddressLink =
    document.getElementById("addAddressLink");


/* =====================================================
   SAVE CHECKOUT RETURN URL
===================================================== */

function saveCheckoutReturnURL() {
    sessionStorage.setItem(
        "aloraReturnUrl",
        window.location.href
    );
}


if (changeProfileLink) {
    changeProfileLink.addEventListener(
        "click",
        saveCheckoutReturnURL
    );
}


if (addAddressLink) {
    addAddressLink.addEventListener(
        "click",
        saveCheckoutReturnURL
    );
}


/* =====================================================
   CHECK LOGIN
===================================================== */

onAuthStateChanged(
    auth,
    async function (user) {

        /* NOT LOGGED IN */

        if (!user) {
            saveCheckoutReturnURL();

            window.location.href =
                "login.html";

            return;
        }


        /* LOGGED IN */

        await loadCheckoutProfile(user);
    }
);


/* =====================================================
   LOAD CUSTOMER PROFILE
===================================================== */

async function loadCheckoutProfile(user) {
    try {
        const userReference =
            doc(db, "users", user.uid);

        const userSnapshot =
            await getDoc(userReference);


        if (!userSnapshot.exists()) {
            showMissingAddress();

            return;
        }


        const profile =
            userSnapshot.data();


        const name =
            profile.name ||
            user.displayName ||
            "";

        const phone =
            profile.phone || "";

        const email =
            profile.email ||
            user.email ||
            "";

        const address =
            profile.address || "";


        /* ADDRESS OR PHONE MISSING */

        if (
            name.trim() === "" ||
            phone.trim() === "" ||
            address.trim() === ""
        ) {
            showMissingAddress();

            return;
        }


        /* SHOW DELIVERY DETAILS */

        checkoutName.textContent =
            name;

        checkoutPhone.textContent =
            phone;

        checkoutEmail.textContent =
            email;

        checkoutAddress.textContent =
            address;


        /* SET VALUES FOR GOOGLE FORM */

        customerNameInput.value =
            name;

        phoneInput.value =
            phone;

        emailInput.value =
            email;

        addressInput.value =
            address;


        /* SHOW CHECKOUT */

        checkoutLoading.hidden = true;

        missingAddress.hidden = true;

        checkoutProfile.hidden = false;

        checkoutOrderDetails.hidden = false;


        /* ENABLE ORDER BUTTON */

        placeOrderButton.disabled = false;

        placeOrderButton.textContent =
            "Place Order";

        if (
            typeof window.updatePlaceOrderAvailability ===
            "function"
        ) {
            window.updatePlaceOrderAvailability();
        }

    } catch (error) {
        checkoutLoading.hidden = true;

        checkoutMessage.textContent =
            "Unable to load your profile. Please refresh and try again.";

        checkoutOrderDetails.hidden = false;

        placeOrderButton.disabled = true;

        placeOrderButton.textContent =
            "Profile Required";
    }
}


/* =====================================================
   SHOW MISSING ADDRESS
===================================================== */

function showMissingAddress() {
    checkoutLoading.hidden = true;

    checkoutProfile.hidden = true;

    missingAddress.hidden = false;

    checkoutOrderDetails.hidden = true;

    saveCheckoutReturnURL();
}
/* =====================================================
   SAVE ORDER TO FIRESTORE
===================================================== */

window.saveOrderToFirestore =
    async function (orderDetails) {

        const user =
            auth.currentUser;

        if (!user) {
            throw new Error(
                "Customer is not logged in."
            );
        }


        const orderReference =
            doc(
                db,
                "users",
                user.uid,
                "orders",
                orderDetails.id
            );


        await setDoc(
            orderReference,
            {
                ...orderDetails,

                userId:
                    user.uid,

                status:
                    "Order Received",

                stockDeducted:
                    false,

                stockRestored:
                    false,

                paymentStatus:
                    orderDetails.payment ===
                    "Cash on Delivery"
                        ? "Pending"
                        : "Payment Verification Pending",

                utr:
                    orderDetails.utr || "",

                cancelRequest:
                    null,

                returnRequest:
                    null,

                exchangeRequest:
                    null,

                createdAt:
                    new Date()
                        .toISOString(),

                updatedAt:
                    new Date()
                        .toISOString()
            }
        );
    };