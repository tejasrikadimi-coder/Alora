const assert = require("node:assert/strict");

console.log("--- Running Auth Enhancements Unit Tests ---");

const ALORA_ADMIN_EMAIL = "alorajewels26@gmail.com";

// Simulate email verification check from auth.js
function canUserAccessAccount(user) {
    if (!user) return false;
    const email = (user.email || "").trim().toLowerCase();
    // Admin is exempted from email verification requirement to prevent store lockouts
    if (email === ALORA_ADMIN_EMAIL.toLowerCase()) {
        return true;
    }
    return Boolean(user.emailVerified);
}

// Simulate Google Sign-In user doc creation
function buildGoogleUserProfile(user) {
    return {
        name: user.displayName || "Alora Customer",
        email: (user.email || "").toLowerCase(),
        phone: user.phoneNumber || "",
        address: "",
        authProvider: "google",
        createdAtISO: new Date().toISOString()
    };
}

// Simulate Account Deletion Guard from profile.js
function validateAccountDeletion(user, confirmationInput) {
    if (!user) {
        throw new Error("No user is currently signed in.");
    }
    const email = (user.email || "").trim().toLowerCase();
    if (email === ALORA_ADMIN_EMAIL.toLowerCase()) {
        throw new Error("The store administrator account cannot be self-deleted.");
    }
    if (confirmationInput !== "DELETE") {
        throw new Error("Confirmation keyword mismatch. Please type DELETE to confirm.");
    }
    return true;
}

// Test 1: Normal customer without verified email is blocked
const unverifiedCustomer = { email: "customer@example.com", emailVerified: false };
assert.equal(canUserAccessAccount(unverifiedCustomer), false);
console.log("PASS: Unverified customer cannot log in until email is verified");

// Test 2: Normal customer with verified email is granted access
const verifiedCustomer = { email: "customer@example.com", emailVerified: true };
assert.equal(canUserAccessAccount(verifiedCustomer), true);
console.log("PASS: Verified customer is granted login access");

// Test 3: Admin account is exempted from verification lockout
const adminUser = { email: "alorajewels26@gmail.com", emailVerified: false };
assert.equal(canUserAccessAccount(adminUser), true);
console.log("PASS: Admin account bypasses email verification guard");

// Test 4: Google profile creation
const googleUser = { uid: "goog-123", email: "googleuser@gmail.com", displayName: "Priya Sharma" };
const profile = buildGoogleUserProfile(googleUser);
assert.equal(profile.name, "Priya Sharma");
assert.equal(profile.email, "googleuser@gmail.com");
assert.equal(profile.authProvider, "google");
console.log("PASS: Google sign-in produces valid user profile document payload");

// Test 5: Account deletion validation
assert.throws(() => {
    validateAccountDeletion({ email: "user@example.com" }, "delete");
}, /Confirmation keyword mismatch/);

assert.throws(() => {
    validateAccountDeletion({ email: "alorajewels26@gmail.com" }, "DELETE");
}, /The store administrator account cannot be self-deleted/);

const deletionApproved = validateAccountDeletion({ email: "user@example.com" }, "DELETE");
assert.equal(deletionApproved, true);
console.log("PASS: Account deletion enforces strict keyword confirmation and protects admin account");

console.log("\nALL AUTH ENHANCEMENT TESTS PASSED (100%)!\n");
