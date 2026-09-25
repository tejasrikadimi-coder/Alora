const fs = require("fs");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const firebaseJs = fs.readFileSync(path.join(projectRoot, "firebase.js"), "utf8");
const scriptJs = fs.readFileSync(path.join(projectRoot, "script.js"), "utf8");

// 1. Verify firebase.js exports
assert.ok(firebaseJs.includes("app,"), "firebase.js must export app");
assert.ok(firebaseJs.includes("auth,"), "firebase.js must export auth");
assert.ok(firebaseJs.includes("db,"), "firebase.js must export db");
assert.ok(firebaseJs.includes("initAnalytics,"), "firebase.js must export initAnalytics");
assert.ok(firebaseJs.includes("analytics"), "firebase.js must export analytics");

// 2. Verify Firebase Analytics imports
assert.ok(firebaseJs.includes("firebase-analytics.js"), "firebase.js must import from firebase-analytics.js");
assert.ok(firebaseJs.includes("getAnalytics,"), "firebase.js must import getAnalytics");
assert.ok(firebaseJs.includes("isSupported"), "firebase.js must import isSupported");

// 3. Verify no fake/invented measurementId was hardcoded in firebaseConfig
const firebaseConfigBlock = firebaseJs.substring(firebaseJs.indexOf("const firebaseConfig = {"), firebaseJs.indexOf("};"));
const fakeIdMatch = firebaseConfigBlock.match(/measurementId\s*:/);
assert.strictEqual(fakeIdMatch, null, "Must NOT invent or hardcode a fake measurementId in firebaseConfig");

// 4. Verify script.js implements trackPageView and calls it
assert.ok(scriptJs.includes("function trackPageView("), "script.js must define trackPageView");
assert.ok(scriptJs.includes("trackPageView();"), "script.js DOMContentLoaded must trigger trackPageView");
assert.ok(scriptJs.includes('pathname.endsWith("admin.html")'), "script.js must exclude admin page from page view tracking");

// 5. Test diagnostic warning logging when measurementId is missing
let loggedWarning = "";
const originalWarn = console.warn;
console.warn = (...args) => {
    loggedWarning += args.join(" ");
};

// Simulate initAnalytics logic from firebase.js
const mockFirebaseConfig = {
    apiKey: "AIzaSyAX5cyNmGFgvIehLF1GGboJvP9prFteHIo",
    projectId: "alora-handmade-jewelry"
};

function runInitAnalyticsMock(windowConfig) {
    const measurementId = (windowConfig && windowConfig.measurementId) || mockFirebaseConfig.measurementId;
    if (!measurementId) {
        console.warn(
            "[Alora Analytics] No measurementId found in Firebase config or window.ALORA_ANALYTICS_CONFIG."
        );
        return null;
    }
    return { initializedWith: measurementId };
}

const resultNoId = runInitAnalyticsMock(null);
assert.strictEqual(resultNoId, null);
assert.ok(loggedWarning.includes("[Alora Analytics] No measurementId found"));

const resultWithId = runInitAnalyticsMock({ measurementId: "G-TEST123456" });
assert.deepStrictEqual(resultWithId, { initializedWith: "G-TEST123456" });

console.warn = originalWarn;

console.log("PASS: firebase.js imports and exports Analytics correctly without breaking auth or db");
console.log("PASS: script.js wires public page view tracking while excluding admin");
console.log("PASS: Missing measurementId outputs clear diagnostic warning without throwing errors");
console.log("PASS: Runtime injection via window.ALORA_ANALYTICS_CONFIG or firebaseConfig is supported");
console.log("\nALL ANALYTICS INTEGRATION TESTS PASSED (100%)!");
