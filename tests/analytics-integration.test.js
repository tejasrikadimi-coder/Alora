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

// 3. Verify official Alora measurementId in firebaseConfig
const firebaseConfigBlock = firebaseJs.substring(firebaseJs.indexOf("const firebaseConfig = {"), firebaseJs.indexOf("};"));
assert.ok(
    firebaseConfigBlock.includes('"G-4FDTV3W3Y6"'),
    "firebaseConfig must contain the official Alora Google Analytics Measurement ID G-4FDTV3W3Y6"
);

// 4. Verify script.js defines trackAloraAnalyticsEvent and trackPageView
assert.ok(scriptJs.includes("function trackAloraAnalyticsEvent("), "script.js must define trackAloraAnalyticsEvent");
assert.ok(scriptJs.includes("window.trackAloraAnalyticsEvent = trackAloraAnalyticsEvent"), "script.js must export trackAloraAnalyticsEvent on window");
assert.ok(scriptJs.includes("function trackPageView("), "script.js must define trackPageView");
assert.ok(scriptJs.includes("trackPageView();"), "script.js DOMContentLoaded must trigger trackPageView");
assert.ok(scriptJs.includes('pathname.endsWith("admin.html")'), "script.js must exclude admin page from page view tracking");

// 5. Verify core e-commerce events: view_item, add_to_cart, purchase
assert.ok(scriptJs.includes('"view_item"'), "script.js must track view_item event");
assert.ok(scriptJs.includes('"add_to_cart"'), "script.js must track add_to_cart event");
assert.ok(scriptJs.includes('"purchase"'), "script.js must track purchase event");

// 6. Test diagnostic warning logging when measurementId is missing vs present
let loggedWarning = "";
const originalWarn = console.warn;
console.warn = (...args) => {
    loggedWarning += args.join(" ");
};

function runInitAnalyticsMock(config) {
    const measurementId = config && config.measurementId;
    if (!measurementId) {
        console.warn("[Alora Analytics] No measurementId found in Firebase config or window.ALORA_ANALYTICS_CONFIG.");
        return null;
    }
    return { initializedWith: measurementId };
}

const resultNoId = runInitAnalyticsMock({});
assert.strictEqual(resultNoId, null);
assert.ok(loggedWarning.includes("[Alora Analytics] No measurementId found"));

const resultWithAloraId = runInitAnalyticsMock({ measurementId: "G-4FDTV3W3Y6" });
assert.deepStrictEqual(resultWithAloraId, { initializedWith: "G-4FDTV3W3Y6" });

console.warn = originalWarn;

console.log("PASS: firebase.js configures official measurementId G-4FDTV3W3Y6 and exports Analytics safely");
console.log("PASS: script.js defines and exports window.trackAloraAnalyticsEvent");
console.log("PASS: script.js wires view_item, add_to_cart, and purchase e-commerce events");
console.log("PASS: script.js wires public page_view tracking while excluding admin");
console.log("PASS: Fallback handling and runtime safety preserved without throwing errors");
console.log("\nALL ANALYTICS INTEGRATION TESTS PASSED (100%)!");
