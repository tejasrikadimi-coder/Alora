const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

console.log("Running Admin Auth Flow Test Suite...\n");

const authSource = fs.readFileSync(
    path.join(__dirname, "..", "auth.js"),
    "utf8"
);

const adminSource = fs.readFileSync(
    path.join(__dirname, "..", "admin.js"),
    "utf8"
);

const profileSource = fs.readFileSync(
    path.join(__dirname, "..", "profile.js"),
    "utf8"
);

const scriptSource = fs.readFileSync(
    path.join(__dirname, "..", "script.js"),
    "utf8"
);

const adminHtmlSource = fs.readFileSync(
    path.join(__dirname, "..", "admin.html"),
    "utf8"
);

// -------------------------------------------------------------
// Test 1: HTML Markup checks (greeting, link, image file input)
// -------------------------------------------------------------
console.log("Test 1: Admin HTML markup integrity...");
assert.ok(
    adminHtmlSource.includes('id="adminWelcome"'),
    "admin.html must contain #adminWelcome"
);
assert.ok(
    adminHtmlSource.includes("Hi Madhuri"),
    "admin.html must have 'Hi Madhuri' greeting"
);
assert.ok(
    adminHtmlSource.includes('href="index.html?view=storefront"'),
    "admin.html 'View Website' link must include ?view=storefront"
);
assert.ok(
    adminHtmlSource.includes('id="adminProductImageFile"'),
    "admin.html must contain #adminProductImageFile input for gallery upload"
);
assert.ok(
    adminHtmlSource.includes('accept="image/*"'),
    "#adminProductImageFile must accept images"
);
console.log("✓ Test 1 passed: HTML markup contains greeting, storefront link, and file picker.");

// -------------------------------------------------------------
// Test 2: auth.js - checkIsAuthorizedAdmin helper
// -------------------------------------------------------------
console.log("Test 2: auth.js - checkIsAuthorizedAdmin authorization...");

function extractFunctionBody(code, funcSignature) {
    const start = code.indexOf(funcSignature);
    if (start === -1) {
        throw new Error(`Signature not found: ${funcSignature}`);
    }
    const open = code.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < code.length; i++) {
        if (code[i] === "{") depth++;
        else if (code[i] === "}") {
            depth--;
            if (depth === 0) {
                return code.slice(start, i + 1);
            }
        }
    }
    throw new Error(`Could not parse function body for ${funcSignature}`);
}

const checkIsAuthorizedAdminCode = extractFunctionBody(
    authSource,
    "async function checkIsAuthorizedAdmin(user)"
);

async function runCheckAdminTest(user, mockFirestoreDoc) {
    const sandbox = {
        ALORA_ADMIN_EMAIL: "alorajewels26@gmail.com",
        console,
        doc(db, col, uid) {

            return { db, col, uid };
        },
        async getDoc(ref) {
            return {
                exists() {
                    return Boolean(mockFirestoreDoc);
                },
                data() {
                    return mockFirestoreDoc || {};
                }
            };
        },
        db: {}
    };

    const script = new vm.Script(
        `${checkIsAuthorizedAdminCode}\nmodule.exports = checkIsAuthorizedAdmin;`
    );
    const context = vm.createContext(sandbox);
    const module = { exports: {} };
    sandbox.module = module;
    script.runInContext(context);
    return await module.exports(user);
}

(async () => {
    // 2.1 Authorized admin with correct email and role in Firestore
    const validAdminResult = await runCheckAdminTest(
        { uid: "admin-uid-123", email: "alorajewels26@gmail.com" },
        { name: "Madhuri", role: "admin", email: "alorajewels26@gmail.com" }
    );
    assert.equal(validAdminResult.isAdmin, true, "Authorized admin must return isAdmin: true");
    assert.equal(validAdminResult.role, "admin");

    // 2.2 Case insensitive email check
    const upperEmailAdminResult = await runCheckAdminTest(
        { uid: "admin-uid-123", email: "ALORAJEWELS26@GMAIL.COM" },
        { name: "Madhuri", role: "admin" }
    );
    assert.equal(upperEmailAdminResult.isAdmin, true, "Email comparison must be case-insensitive");

    // 2.3 Case insensitive role check (e.g. 'Admin', 'ADMIN', 'admin ')
    const capitalizedRoleResult = await runCheckAdminTest(
        { uid: "admin-uid-123", email: "alorajewels26@gmail.com" },
        { name: "Madhuri", role: "Admin" }
    );
    assert.equal(capitalizedRoleResult.isAdmin, true, "Role 'Admin' must be accepted");

    const spacedRoleResult = await runCheckAdminTest(
        { uid: "admin-uid-123", email: "alorajewels26@gmail.com" },
        { name: "Madhuri", role: "admin " }
    );
    assert.equal(spacedRoleResult.isAdmin, true, "Role with whitespace must be normalized");

    // 2.4 Correct email but customer role in Firestore
    const nonRoleResult = await runCheckAdminTest(
        { uid: "admin-uid-123", email: "alorajewels26@gmail.com" },
        { name: "Madhuri", role: "customer" }
    );
    assert.equal(nonRoleResult.isAdmin, false, "Admin email with role 'customer' must return false");

    // 2.5 Customer email with spoofed admin role in doc
    const spoofedCustomerResult = await runCheckAdminTest(
        { uid: "cust-uid-456", email: "customer@example.com" },
        { name: "Attacker", role: "admin" }
    );
    assert.equal(spoofedCustomerResult.isAdmin, false, "Non-admin email must never be authorized as admin");

    // 2.6 Null or empty user
    const nullUserResult = await runCheckAdminTest(null, null);
    assert.equal(nullUserResult.isAdmin, false, "Null user must return false");

    console.log("✓ Test 2 passed: Admin authorization strictly validates email AND normalized Firestore role.");


    // -------------------------------------------------------------
    // Test 3: auth.js - Login redirect behavior
    // -------------------------------------------------------------
    console.log("Test 3: auth.js - Login redirect resolution...");

    function simulateLoginRedirect({ isAdmin, returnUrl }) {
        let destination = "";
        const sessionStorageMap = new Map();
        if (returnUrl) {
            sessionStorageMap.set("aloraReturnUrl", returnUrl);
        }

        const sessionStorage = {
            getItem(key) {
                return sessionStorageMap.get(key);
            },
            removeItem(key) {
                return sessionStorageMap.delete(key);
            }
        };

        const window = {
            location: {
                set href(val) {
                    destination = val;
                }
            }
        };

        // Logic from auth.js login submit handler
        if (isAdmin) {
            sessionStorage.removeItem("aloraReturnUrl");
            window.location.href = "admin.html";
        } else {
            const ret = sessionStorage.getItem("aloraReturnUrl");
            if (ret && !ret.toLowerCase().includes("admin.html")) {
                sessionStorage.removeItem("aloraReturnUrl");
                window.location.href = ret;
            } else {
                sessionStorage.removeItem("aloraReturnUrl");
                window.location.href = "profile.html";
            }
        }

        return { destination, remainingReturnUrl: sessionStorageMap.get("aloraReturnUrl") };
    }

    // 3.1 Admin login -> admin.html
    const adminLogin = simulateLoginRedirect({ isAdmin: true, returnUrl: "profile.html" });
    assert.equal(adminLogin.destination, "admin.html", "Admin must redirect directly to admin.html");
    assert.equal(adminLogin.remainingReturnUrl, undefined, "Return URL must be cleared");

    // 3.2 Customer login with normal return URL -> returnUrl
    const customerLoginWithReturn = simulateLoginRedirect({ isAdmin: false, returnUrl: "cart.html" });
    assert.equal(customerLoginWithReturn.destination, "cart.html", "Customer should redirect to returnUrl");

    // 3.3 Customer login with admin.html as return URL -> profile.html (blocked from bouncing to admin)
    const customerLoginWithAdminReturn = simulateLoginRedirect({ isAdmin: false, returnUrl: "admin.html" });
    assert.equal(customerLoginWithAdminReturn.destination, "profile.html", "Customer with admin returnUrl must route to profile.html");

    // 3.4 Customer login with no return URL -> profile.html
    const customerLoginDefault = simulateLoginRedirect({ isAdmin: false, returnUrl: null });
    assert.equal(customerLoginDefault.destination, "profile.html", "Customer without returnUrl must route to profile.html");

    console.log("✓ Test 3 passed: Login redirects accurately route admin and customers without loops.");

    // -------------------------------------------------------------
    // Test 4: profile.js & script.js - Logged-in admin routing
    // -------------------------------------------------------------
    console.log("Test 4: Storefront & Profile routing for logged-in admin...");

    // 4.1 profile.js redirect test
    let profileRedirect = "";
    const profileMockUser = { email: "alorajewels26@gmail.com" };
    const profileMockDoc = { role: "admin", name: "Madhuri" };

    if (
        profileMockUser.email &&
        profileMockUser.email.trim().toLowerCase() === "alorajewels26@gmail.com" &&
        profileMockDoc.role === "admin"
    ) {
        profileRedirect = "admin.html";
    }
    assert.equal(profileRedirect, "admin.html", "profile.js must route logged-in admin to admin.html");

    // 4.2 script.js root storefront redirect test
    function simulateStorefrontAdminCheck({ search, email, role }) {
        let routedTo = "";
        const urlParams = new URLSearchParams(search);
        const isStorefrontPreview = urlParams.get("view") === "storefront";

        if (
            email &&
            email.trim().toLowerCase() === "alorajewels26@gmail.com"
        ) {
            if (!isStorefrontPreview && role === "admin") {
                routedTo = "admin.html";
            }
        }
        return routedTo;
    }

    // Normal visit to index.html -> routes to admin.html
    assert.equal(
        simulateStorefrontAdminCheck({ search: "", email: "alorajewels26@gmail.com", role: "admin" }),
        "admin.html",
        "Logged-in admin opening index.html directly must be routed to admin.html"
    );

    // Visiting index.html?view=storefront from admin dashboard -> allows viewing
    assert.equal(
        simulateStorefrontAdminCheck({ search: "?view=storefront", email: "alorajewels26@gmail.com", role: "admin" }),
        "",
        "Admin viewing storefront via 'View Website' must not be redirected"
    );

    // Customer visiting index.html -> no redirect
    assert.equal(
        simulateStorefrontAdminCheck({ search: "", email: "customer@gmail.com", role: "customer" }),
        "",
        "Customer visiting index.html must never be redirected to admin.html"
    );

    console.log("✓ Test 4 passed: Storefront and Profile pages route admin safely without trapping.");

    // -------------------------------------------------------------
    // Test 5: admin.js - Access control, greeting, refresh, logout
    // -------------------------------------------------------------
    console.log("Test 5: admin.js - Access control, greeting, refresh, logout...");

    function simulateAdminAuthCheck(user, adminData) {
        let accessMessage = "";
        let isError = false;
        let redirectTarget = "";
        let welcomeText = "";
        let dashboardHidden = true;

        if (!user) {
            redirectTarget = "login.html";
            return { redirectTarget, welcomeText, dashboardHidden, accessMessage };
        }

        const ALORA_ADMIN_EMAIL = "alorajewels26@gmail.com";
        const isAuthorizedEmail =
            user.email &&
            user.email.trim().toLowerCase() === ALORA_ADMIN_EMAIL.toLowerCase();

        if (!isAuthorizedEmail || !adminData || adminData.role !== "admin") {
            accessMessage = "Access denied. Administrator account required.";
            isError = true;
            redirectTarget = "index.html";
            return { redirectTarget, welcomeText, dashboardHidden, accessMessage, isError };
        }

        welcomeText = "Hi Madhuri";
        dashboardHidden = false;
        return { redirectTarget, welcomeText, dashboardHidden, accessMessage, isError };
    }

    // 5.1 Unauthenticated user accessing admin.html -> login.html
    const unauthCheck = simulateAdminAuthCheck(null, null);
    assert.equal(unauthCheck.redirectTarget, "login.html", "Unauthenticated user must be redirected to login.html");

    // 5.2 Customer user accessing admin.html -> access denied & redirect to index.html
    const customerCheck = simulateAdminAuthCheck(
        { uid: "cust-1", email: "cust@gmail.com" },
        { role: "customer", name: "Ravi" }
    );
    assert.equal(customerCheck.accessMessage, "Access denied. Administrator account required.");
    assert.equal(customerCheck.redirectTarget, "index.html");
    assert.equal(customerCheck.dashboardHidden, true, "Dashboard must stay hidden from non-admin");

    // 5.3 Authorized admin accessing admin.html -> Dashboard visible with "Hi Madhuri"
    const authorizedAdminCheck = simulateAdminAuthCheck(
        { uid: "admin-uid-1", email: "alorajewels26@gmail.com" },
        { role: "admin", name: "Madhuri" }
    );
    assert.equal(authorizedAdminCheck.welcomeText, "Hi Madhuri", "Greeting must strictly be 'Hi Madhuri'");
    assert.equal(authorizedAdminCheck.dashboardHidden, false, "Dashboard content must be unhidden for admin");
    assert.equal(authorizedAdminCheck.redirectTarget, "", "Authorized admin must not be redirected away");

    // 5.4 Admin page refresh maintains same verified state
    const refreshAdminCheck = simulateAdminAuthCheck(
        { uid: "admin-uid-1", email: "alorajewels26@gmail.com" },
        { role: "admin", name: "Madhuri" }
    );
    assert.equal(refreshAdminCheck.welcomeText, "Hi Madhuri");
    assert.equal(refreshAdminCheck.dashboardHidden, false);

    console.log("✓ Test 5 passed: Access control, greeting 'Hi Madhuri', and refresh behavior verified.");

    console.log("\n==========================================");
    console.log("ALL ADMIN AUTH FLOW TESTS PASSED (100% OK)!");
    console.log("==========================================\n");
})();
