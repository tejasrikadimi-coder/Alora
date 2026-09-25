const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(
    path.resolve(__dirname, "..", "script.js"),
    "utf8"
);
const checkoutProfile = fs.readFileSync(
    path.resolve(__dirname, "..", "checkout-profile.js"),
    "utf8"
);

assert.match(
    script,
    /const ALORA_UPI_ID = "9392159623@ybl"/
);
assert.match(
    checkoutProfile,
    /paymentStatus:\s*[\s\S]*Payment Verification Pending/
);
assert.match(
    script,
    /QRCode\.toCanvas/
);
assert.match(
    script,
    /utrInput\.value\.trim/
);

const orderHtml = fs.readFileSync(
    path.resolve(__dirname, "..", "order.html"),
    "utf8"
);
assert.doesNotMatch(orderHtml, /Bank Transfer/);
assert.match(orderHtml, /Online Payment \(UPI\)/);
const admin = fs.readFileSync(
    path.resolve(__dirname, "..", "admin.js"),
    "utf8"
);
assert.match(
    admin,
    /Payment Verification Pending/
);
console.log(
    "PASS dynamic UPI checkout markup, QR generation, UTR validation, and payment status wiring"
);
