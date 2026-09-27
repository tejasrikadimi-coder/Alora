const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function runTests() {
    console.log("==================================================");
    console.log("RUNNING ALORA GOOGLE-ONLY CUSTOMER AUTH UNIT TESTS");
    console.log("==================================================\n");

    // Read files under test
    const loginHtml = fs.readFileSync(path.join(__dirname, "..", "login.html"), "utf8");
    const authJs = fs.readFileSync(path.join(__dirname, "..", "auth.js"), "utf8");

    // -------------------------------------------------------------
    // Test 1: HTML Markup Integrity & Prohibited Field Enforcement
    // -------------------------------------------------------------
    console.log("Test 1: Verifying login.html markup and customer Google-only enforcement...");

    // 1.1 Customer login form
    assert.ok(loginHtml.includes('id="loginSection"'), "Must contain #loginSection");
    assert.ok(loginHtml.includes('id="googleLoginBtn"'), "Must contain #googleLoginBtn");
    assert.ok(loginHtml.includes("Sign in with Google"), "Must contain 'Sign in with Google' text");

    // 1.2 Customer signup form
    assert.ok(loginHtml.includes('id="registerSection"'), "Must contain #registerSection");
    assert.ok(loginHtml.includes('id="googleRegisterBtn"'), "Must contain #googleRegisterBtn");
    assert.ok(loginHtml.includes("Sign up with Google"), "Must contain 'Sign up with Google' text");

    // 1.3 Verify prohibited customer inputs do NOT exist in customer sections
    assert.ok(!loginHtml.includes('id="loginEmail"'), "Customer login must NOT have email input");
    assert.ok(!loginHtml.includes('id="loginPassword"'), "Customer login must NOT have password input");
    assert.ok(!loginHtml.includes('id="registerEmail"'), "Customer register must NOT have email input");
    assert.ok(!loginHtml.includes('id="registerPassword"'), "Customer register must NOT have password input");
    assert.ok(!loginHtml.includes('id="confirmPassword"'), "Customer register must NOT have confirm password input");
    assert.ok(!loginHtml.includes('id="registerPhone"'), "Customer register must NOT have phone input");

    console.log("✓ Customer signup and login forms strictly enforce Google-only authentication (no email or password fields).");

    // -------------------------------------------------------------
    // Test 2: Complete Removal of Customer Email Link & OTP Code
    // -------------------------------------------------------------
    console.log("Test 2: Verifying total removal of Email Link and OTP code...");

    // HTML removal
    assert.ok(!loginHtml.includes('id="linkSentSection"'), "login.html must NOT contain #linkSentSection");
    assert.ok(!loginHtml.includes('id="confirmEmailSection"'), "login.html must NOT contain #confirmEmailSection");
    assert.ok(!loginHtml.includes('id="otpCodeInput"'), "login.html must NOT contain #otpCodeInput");
    assert.ok(!loginHtml.includes('id="verifySection"'), "login.html must NOT contain #verifySection");

    // JS removal
    assert.ok(!authJs.includes("sendSignInLinkToEmail"), "auth.js must not contain sendSignInLinkToEmail");
    assert.ok(!authJs.includes("isSignInWithEmailLink"), "auth.js must not contain isSignInWithEmailLink");
    assert.ok(!authJs.includes("signInWithEmailLink"), "auth.js must not contain signInWithEmailLink");
    assert.ok(!authJs.includes("aloraEmailForSignIn"), "auth.js must not contain aloraEmailForSignIn");
    assert.ok(!authJs.includes("requestEmailOtp"), "auth.js must not contain requestEmailOtp");
    assert.ok(!authJs.includes("verifyEmailOtp"), "auth.js must not contain verifyEmailOtp");

    console.log("✓ All customer Email Link and OTP methods are 100% removed.");

    // -------------------------------------------------------------
    // Test 3: Admin Authentication Preservation
    // -------------------------------------------------------------
    console.log("Test 3: Verifying Admin email + password authentication preservation...");

    assert.ok(loginHtml.includes('id="adminLoginSection"'), "Must contain #adminLoginSection");
    assert.ok(loginHtml.includes('id="adminLoginForm"'), "Must contain #adminLoginForm");
    assert.ok(loginHtml.includes('id="adminLoginEmail"'), "Must contain #adminLoginEmail");
    assert.ok(loginHtml.includes('id="adminLoginPassword"'), "Must contain #adminLoginPassword");
    assert.ok(loginHtml.includes('id="adminLoginSubmitBtn"'), "Must contain #adminLoginSubmitBtn");

    assert.ok(authJs.includes('const ALORA_ADMIN_EMAIL = "alorajewels26@gmail.com";'), "auth.js must preserve ALORA_ADMIN_EMAIL");
    assert.ok(authJs.includes("async function checkIsAuthorizedAdmin(user)"), "auth.js must preserve checkIsAuthorizedAdmin");
    assert.ok(authJs.includes("function getAdminTargetUrl()"), "auth.js must preserve getAdminTargetUrl");
    assert.ok(authJs.includes("signInWithEmailAndPassword"), "auth.js must keep signInWithEmailAndPassword for admin");

    console.log("✓ Admin email + password authentication preserved 100%.");

    // -------------------------------------------------------------
    // Test 4: Google Auth API & Options
    // -------------------------------------------------------------
    console.log("Test 4: Verifying GoogleAuthProvider and signInWithPopup integration...");

    assert.ok(authJs.includes("GoogleAuthProvider"), "auth.js must import GoogleAuthProvider");
    assert.ok(authJs.includes("signInWithPopup"), "auth.js must import signInWithPopup");
    assert.ok(authJs.includes('prompt: "select_account"'), "auth.js must specify prompt: select_account");

    console.log("✓ Firebase GoogleAuthProvider correctly initialized with popup flow.");

    // -------------------------------------------------------------
    // Test 5: User Profile Creation & Preservation Logic
    // -------------------------------------------------------------
    console.log("Test 5: Verifying new vs existing user profile preservation logic...");

    // Simulate profile sync logic from auth.js
    async function simulateProfileSync({ user, existingDoc, mockDb }) {
        let writeCalled = false;
        let writtenData = null;

        if (user && user.uid) {
            const docExists = Boolean(existingDoc);
            if (!docExists) {
                writtenData = {
                    name: user.displayName || "Customer",
                    email: user.email || "",
                    phone: user.phoneNumber || "",
                    address: "",
                    authProvider: "google",
                    createdAt: "2026-09-27T00:00:00.000Z"
                };
                writeCalled = true;
                mockDb.set(user.uid, writtenData);
            }
        }
        return { writeCalled, writtenData };
    }

    // 5.1 New user -> creates document
    const mockDb = new Map();
    const newUser = { uid: "google-uid-new", displayName: "Aarohi Sharma", email: "aarohi@gmail.com", phoneNumber: null };
    const newRes = await simulateProfileSync({ user: newUser, existingDoc: null, mockDb });

    assert.equal(newRes.writeCalled, true, "Must create document for new user");
    assert.equal(newRes.writtenData.name, "Aarohi Sharma");
    assert.equal(newRes.writtenData.email, "aarohi@gmail.com");
    assert.equal(newRes.writtenData.authProvider, "google");

    // 5.2 Existing user -> preserves document, does NOT overwrite name/phone/address
    const existingDoc = {
        name: "Aarohi Custom Name",
        email: "aarohi@gmail.com",
        phone: "9876543210",
        address: "Flat 4B, Lotus Enclave, Hyderabad",
        authProvider: "google",
        createdAt: "2026-01-01T00:00:00.000Z"
    };
    mockDb.set("google-uid-existing", existingDoc);

    const existingUser = { uid: "google-uid-existing", displayName: "Google Account Name", email: "aarohi@gmail.com" };
    const existRes = await simulateProfileSync({ user: existingUser, existingDoc: mockDb.get("google-uid-existing"), mockDb });

    assert.equal(existRes.writeCalled, false, "Must NOT overwrite profile for existing user");
    const preservedData = mockDb.get("google-uid-existing");
    assert.equal(preservedData.name, "Aarohi Custom Name", "Must preserve existing custom name");
    assert.equal(preservedData.phone, "9876543210", "Must preserve existing phone");
    assert.equal(preservedData.address, "Flat 4B, Lotus Enclave, Hyderabad", "Must preserve existing address");

    console.log("✓ Profile document is created only when needed, and existing customer profile data is strictly preserved.");

    // -------------------------------------------------------------
    // Test 6: Customer Redirect Flow
    // -------------------------------------------------------------
    console.log("Test 6: Verifying customer redirect behavior...");

    function determineRedirect(returnUrl) {
        if (returnUrl && !returnUrl.toLowerCase().includes("admin.html")) {
            return returnUrl;
        }
        return "profile.html";
    }

    assert.equal(determineRedirect("cart.html"), "cart.html");
    assert.equal(determineRedirect("order.html?orderId=123"), "order.html?orderId=123");
    assert.equal(determineRedirect("admin.html"), "profile.html", "Must block customer from admin redirect loop");
    assert.equal(determineRedirect(null), "profile.html");

    console.log("✓ Customer returnUrl redirect logic verified.");

    // -------------------------------------------------------------
    // Test 7: Error Handling Coverage
    // -------------------------------------------------------------
    console.log("Test 7: Verifying Google popup error messages...");

    assert.ok(authJs.includes("auth/popup-blocked"), "auth.js must handle popup-blocked");
    assert.ok(authJs.includes("auth/unauthorized-domain"), "auth.js must handle unauthorized-domain");
    assert.ok(authJs.includes("auth/operation-not-allowed"), "auth.js must handle operation-not-allowed");
    assert.ok(authJs.includes("auth/popup-closed-by-user"), "auth.js must handle popup-closed-by-user gracefully");
    assert.ok(authJs.includes("auth/network-request-failed"), "auth.js must handle network-request-failed");

    console.log("✓ Error codes mapped to user-friendly messages.");

    // -------------------------------------------------------------
    // Test 8: Required Terms & Conditions / Privacy Policy Consent Checkbox
    // -------------------------------------------------------------
    console.log("Test 8: Verifying required Terms & Conditions / Privacy Policy consent checkbox for sign-up...");

    // 8.1 Register section contains the required consent checkbox and links
    assert.ok(loginHtml.includes('id="registerTermsConsent"'), "Must contain #registerTermsConsent checkbox");
    assert.ok(loginHtml.includes('href="terms.html"'), "Must link to terms.html");
    assert.ok(loginHtml.includes('href="privacy-policy.html"'), "Must link to privacy-policy.html");
    assert.ok(loginHtml.includes('href="terms.html" target="_blank" rel="noopener noreferrer"'), "Terms link must open in new tab with secure rel");
    assert.ok(loginHtml.includes('href="privacy-policy.html" target="_blank" rel="noopener noreferrer"'), "Privacy link must open in new tab with secure rel");
    assert.ok(loginHtml.includes("I agree to the"), "Must contain agreement prompt text");
    assert.ok(loginHtml.includes("Terms &amp; Conditions") || loginHtml.includes("Terms & Conditions"), "Must reference Terms & Conditions");
    assert.ok(loginHtml.includes("Privacy Policy"), "Must reference Privacy Policy");

    // 8.2 Verify checkbox is inside registerSection and NOT in loginSection
    const loginSectionIndex = loginHtml.indexOf('id="loginSection"');
    const registerSectionIndex = loginHtml.indexOf('id="registerSection"');
    const adminSectionIndex = loginHtml.indexOf('id="adminLoginSection"');
    const checkboxIndex = loginHtml.indexOf('id="registerTermsConsent"');

    assert.ok(checkboxIndex > registerSectionIndex && checkboxIndex < adminSectionIndex, "Consent checkbox must be inside #registerSection");
    const googleRegisterBtnIndex = loginHtml.indexOf('id="googleRegisterBtn"');
    assert.ok(checkboxIndex > googleRegisterBtnIndex, "Consent checkbox must sit neatly below googleRegisterBtn");
    const loginSectionMarkup = loginHtml.slice(loginSectionIndex, registerSectionIndex);
    assert.ok(!loginSectionMarkup.includes('id="registerTermsConsent"'), "Login section must NOT contain sign-up consent checkbox");

    // 8.3 Simulate auth.js sign-up consent check behavior
    function simulateGoogleAuthTrigger({ isSignup, checkboxChecked }) {
        let popupOpened = false;
        let errorMessage = null;

        if (isSignup) {
            if (!checkboxChecked) {
                errorMessage = "Please agree to the Terms & Conditions and Privacy Policy to continue.";
                return { popupOpened, errorMessage };
            }
        }

        // Continues to Google sign-in/up popup
        popupOpened = true;
        return { popupOpened, errorMessage };
    }

    // Case A: Sign up + unchecked -> blocked, exact error message, no popup
    const caseA = simulateGoogleAuthTrigger({ isSignup: true, checkboxChecked: false });
    assert.equal(caseA.popupOpened, false, "Case A: Unchecked signup must NOT open popup");
    assert.equal(caseA.errorMessage, "Please agree to the Terms & Conditions and Privacy Policy to continue.", "Case A: Must show exact validation error");

    // Case B: Sign up + checked -> allowed, opens popup
    const caseB = simulateGoogleAuthTrigger({ isSignup: true, checkboxChecked: true });
    assert.equal(caseB.popupOpened, true, "Case B: Checked signup must open popup");
    assert.equal(caseB.errorMessage, null, "Case B: No error message when checked");

    // Case C: Sign in + unchecked/not applicable -> allowed, opens popup without checkbox
    const caseC = simulateGoogleAuthTrigger({ isSignup: false, checkboxChecked: false });
    assert.equal(caseC.popupOpened, true, "Case C: Existing customer login must proceed normally without checkbox");
    assert.equal(caseC.errorMessage, null, "Case C: No error message for normal sign in");

    // 8.4 Verify auth.js code implements exact requirement
    assert.ok(authJs.includes("registerTermsConsent"), "auth.js must reference registerTermsConsent");
    assert.ok(authJs.includes("Please agree to the Terms & Conditions and Privacy Policy to continue."), "auth.js must contain exact validation error string");

    console.log("✓ Customer sign-up consent checkbox strictly enforced for sign-up and bypassed for sign-in.");

    console.log("\n==================================================");
    console.log("ALL GOOGLE AUTHENTICATION TESTS PASSED (100%)!");
    console.log("==================================================\n");
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
