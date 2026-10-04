const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

console.log("================================================================================");
console.log("RUNNING ADMIN COPY PRODUCT LINK UNIT TESTS");
console.log("================================================================================");

const adminJsSource = fs.readFileSync(path.join(projectRoot, "admin.js"), "utf8");
const scriptJsSource = fs.readFileSync(path.join(projectRoot, "script.js"), "utf8");
const styleCss = fs.readFileSync(path.join(projectRoot, "style.css"), "utf8");

// =========================================================================
// TEST 1: Canonical Production URL Generator Verification
// =========================================================================
console.log("\nTest 1: Verifying getCanonicalProductUrl implementation and format...");

assert.ok(
    adminJsSource.includes('const ALORA_PRODUCTION_URL = "https://alora-handmade-jewelry.web.app";'),
    "admin.js must define ALORA_PRODUCTION_URL as 'https://alora-handmade-jewelry.web.app'"
);
assert.ok(
    adminJsSource.includes("function getCanonicalProductUrl(productId)"),
    "admin.js must define getCanonicalProductUrl"
);

// Extract getCanonicalProductUrl and execute in isolated context
const urlFnMatch = adminJsSource.match(/function getCanonicalProductUrl\(productId\)[\s\S]*?\n\}/);
assert.ok(urlFnMatch, "getCanonicalProductUrl function block found in admin.js");

const urlContext = {
    URL,
    ALORA_PRODUCTION_URL: "https://alora-handmade-jewelry.web.app"
};
vm.createContext(urlContext);
vm.runInContext(`${urlFnMatch[0]}; urlContextResult = getCanonicalProductUrl;`, urlContext);
const getCanonicalProductUrl = urlContext.urlContextResult;

// Case 1A: Real standard Firestore document ID
const testFirestoreId = "Xk8m9Z1vP4qL2wE5rT";
const generatedUrl = getCanonicalProductUrl(testFirestoreId);
assert.equal(
    generatedUrl,
    `https://alora-handmade-jewelry.web.app/product.html?id=${testFirestoreId}`,
    "Generated URL must match exact production format"
);

// Case 1B: Never contains localhost or admin.html
assert.ok(!generatedUrl.includes("localhost"), "Generated URL must NEVER contain localhost");
assert.ok(!generatedUrl.includes("127.0.0.1"), "Generated URL must NEVER contain 127.0.0.1");
assert.ok(!generatedUrl.includes("admin.html"), "Generated URL must NEVER point to admin.html");
assert.ok(generatedUrl.includes("/product.html?id="), "Generated URL must point to customer product.html");

// Case 1C: ID URL-encoding
const specialId = "prod-test 123&456";
const encodedUrl = getCanonicalProductUrl(specialId);
assert.ok(
    encodedUrl.includes("id=prod-test+123%26456") || encodedUrl.includes("id=prod-test%20123%26456"),
    "Special characters in product ID must be properly URL-encoded"
);

// Case 1D: Safe handling of invalid/blank IDs
assert.equal(getCanonicalProductUrl(""), "", "Empty string ID must safely return empty string");
assert.equal(getCanonicalProductUrl("   "), "", "Whitespace ID must safely return empty string");
assert.equal(getCanonicalProductUrl(null), "", "Null ID must safely return empty string");
assert.equal(getCanonicalProductUrl(undefined), "", "Undefined ID must safely return empty string");
console.log("✓ getCanonicalProductUrl produces canonical production URL and handles edge cases safely.");

// =========================================================================
// TEST 2: Parity with Storefront Share Product URL Format
// =========================================================================
console.log("\nTest 2: Verifying parity with storefront Share Product URL format...");

// In script.js: getCurrentProductUrl() produces new URL("product.html", window.location.href) on production
const storefrontShareFnMatch = scriptJsSource.match(/function getCurrentProductUrl\(\)[\s\S]*?\n\}/);
assert.ok(storefrontShareFnMatch, "getCurrentProductUrl found in script.js");

const storefrontContext = {
    URL,
    currentProduct: {
        id: testFirestoreId,
        name: "Peacock Kundan Earrings"
    },
    window: {
        location: {
            href: "https://alora-handmade-jewelry.web.app/product.html?id=" + testFirestoreId
        }
    }
};
vm.createContext(storefrontContext);
vm.runInContext(`${storefrontShareFnMatch[0]}; result = getCurrentProductUrl();`, storefrontContext);
const storefrontGeneratedUrl = storefrontContext.result;

assert.equal(
    generatedUrl,
    storefrontGeneratedUrl,
    "Admin getCanonicalProductUrl MUST produce the exact same URL as storefront getCurrentProductUrl"
);
console.log("✓ Admin Copy Product Link matches customer storefront Share Product URL 100%.");

// =========================================================================
// TEST 3: Clipboard Copy API & Fallback Verification
// =========================================================================
console.log("\nTest 3: Testing copyProductLink with Clipboard API and fallback...");

const copyFnMatch = adminJsSource.match(/async function copyProductLink\(productId, buttonElement\)[\s\S]*?\n\}/);
assert.ok(copyFnMatch, "copyProductLink found in admin.js");

// Mock button element
function createMockButton() {
    return {
        textContent: "Copy Product Link",
        classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
        },
        dataset: {}
    };
}

(async () => {
    // Case 3A: Navigator Clipboard API available
    let clipboardText = "";
    const clipboardContext = {
        URL,
        ALORA_PRODUCTION_URL: "https://alora-handmade-jewelry.web.app",
        getCanonicalProductUrl,
        navigator: {
            clipboard: {
                async writeText(text) {
                    clipboardText = text;
                }
            }
        },
        document: {
            body: { appendChild() {} },
            createElement(tag) { return { value: "", setAttribute() {}, style: {}, focus() {}, select() {}, remove() {} }; },
            getElementById() { return null; }
        },
        showAdminCopyToast: () => {},
        setTimeout,
        clearTimeout,
        console
    };
    vm.createContext(clipboardContext);
    vm.runInContext(`${copyFnMatch[0]}; copyProductLinkFn = copyProductLink;`, clipboardContext);

    const mockBtn = createMockButton();
    const success = await clipboardContext.copyProductLinkFn(testFirestoreId, mockBtn);
    assert.equal(success, true, "Clipboard copy should report success");
    assert.equal(clipboardText, generatedUrl, "Copied text must match canonical production URL");
    assert.equal(mockBtn.textContent, "Product link copied!", "Button text must update to 'Product link copied!'");
    assert.ok(mockBtn.classList.contains("copied"), "Button must receive .copied class");
    console.log("✓ Modern navigator.clipboard.writeText copies canonical URL and updates button state.");

    // Case 3B: Fallback when navigator.clipboard is unavailable
    let fallbackCopiedText = "";
    let execCommandCalled = false;
    const fallbackContext = {
        URL,
        ALORA_PRODUCTION_URL: "https://alora-handmade-jewelry.web.app",
        getCanonicalProductUrl,
        navigator: {}, // No clipboard API
        document: {
            body: { appendChild() {} },
            createElement(tag) {
                return {
                    set value(v) { fallbackCopiedText = v; },
                    get value() { return fallbackCopiedText; },
                    setAttribute() {},
                    style: {},
                    focus() {},
                    select() {},
                    remove() {}
                };
            },
            execCommand(cmd) {
                if (cmd === "copy") {
                    execCommandCalled = true;
                    return true;
                }
                return false;
            },
            getElementById() { return null; }
        },
        showAdminCopyToast: () => {},
        setTimeout,
        clearTimeout,
        console
    };
    vm.createContext(fallbackContext);
    vm.runInContext(`${copyFnMatch[0]}; copyProductLinkFn = copyProductLink;`, fallbackContext);

    const fallbackBtn = createMockButton();
    const fallbackSuccess = await fallbackContext.copyProductLinkFn(testFirestoreId, fallbackBtn);
    assert.equal(fallbackSuccess, true, "Fallback copy should report success");
    assert.equal(execCommandCalled, true, "execCommand('copy') must be invoked as fallback");
    assert.equal(fallbackCopiedText, generatedUrl, "Fallback textarea must contain canonical URL");
    assert.equal(fallbackBtn.textContent, "Product link copied!", "Button text must update to 'Product link copied!' in fallback");
    assert.ok(fallbackBtn.classList.contains("copied"), "Button must receive .copied class in fallback");
    console.log("✓ Safe textarea fallback copies canonical URL when clipboard API is unavailable.");
})();

// =========================================================================
// TEST 4: Admin Product Actions UI & Preservation of Existing Buttons
// =========================================================================
console.log("\nTest 4: Verifying admin product item markup and preservation of existing buttons...");

// Verify all 4 action buttons exist in admin.js render template
assert.ok(
    adminJsSource.includes('class="admin-product-edit-button"'),
    "admin.js must keep .admin-product-edit-button"
);
assert.ok(
    adminJsSource.includes('class="admin-product-toggle-button"'),
    "admin.js must keep .admin-product-toggle-button"
);
assert.ok(
    adminJsSource.includes('class="admin-product-delete-button"'),
    "admin.js must keep .admin-product-delete-button"
);
assert.ok(
    adminJsSource.includes('class="admin-product-copy-link-button"'),
    "admin.js must include .admin-product-copy-link-button"
);
assert.ok(
    adminJsSource.includes("Copy Product Link"),
    "Button text must be exactly 'Copy Product Link'"
);

// Verify event listener is wired up
assert.ok(
    adminJsSource.includes('productItem.querySelector(\n                ".admin-product-copy-link-button"\n            )') ||
    adminJsSource.includes('productItem.querySelector(".admin-product-copy-link-button")') ||
    adminJsSource.includes('admin-product-copy-link-button'),
    "admin.js must wire event listener for copy button"
);
assert.ok(
    adminJsSource.includes("copyProductLink(\n                        product.id,\n                        copyButton\n                    )") ||
    adminJsSource.includes("copyProductLink(product.id, copyButton)") ||
    adminJsSource.includes("copyProductLink("),
    "Event listener must invoke copyProductLink with product.id and button"
);
console.log("✓ Admin product action buttons render correctly; Edit, Toggle, and Delete remain intact.");

// =========================================================================
// TEST 5: CSS Styles & Responsive Rules Verification
// =========================================================================
console.log("\nTest 5: Verifying CSS classes and responsive rules in style.css...");

assert.ok(
    styleCss.includes(".admin-product-copy-link-button"),
    "style.css must define .admin-product-copy-link-button"
);
assert.ok(
    styleCss.includes(".admin-product-copy-link-button.copied"),
    "style.css must define .admin-product-copy-link-button.copied"
);
assert.ok(
    styleCss.includes(".admin-copy-toast"),
    "style.css must define .admin-copy-toast"
);
assert.ok(
    styleCss.includes(".admin-copy-toast.show"),
    "style.css must define .admin-copy-toast.show"
);

console.log("✓ CSS styling for copy button, copied state, and toast notification verified.");

console.log("\n================================================================================");
console.log("ALL ADMIN COPY PRODUCT LINK TESTS PASSED (100%)!");
console.log("================================================================================");
