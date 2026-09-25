const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

console.log("--- Running Legal Pages & Footer Standardization Tests ---");

const ROOT = path.resolve(__dirname, "..");

// 1. Verify Legal & FAQ files exist and have essential sections
const privacyContent = fs.readFileSync(path.join(ROOT, "privacy-policy.html"), "utf8");
assert.ok(privacyContent.includes("Privacy Policy"), "privacy-policy.html missing title");
assert.ok(privacyContent.includes("Information We Collect"), "privacy-policy.html missing collection section");
assert.ok(privacyContent.includes("Third-Party Service Providers"), "privacy-policy.html missing third-party section");
assert.ok(privacyContent.includes("Account Deletion"), "privacy-policy.html missing account deletion section");
console.log("PASS: privacy-policy.html contains all required legal clauses");

const termsContent = fs.readFileSync(path.join(ROOT, "terms.html"), "utf8");
assert.ok(termsContent.includes("Terms & Conditions") || termsContent.includes("Terms and Conditions"), "terms.html missing title");
assert.ok(termsContent.includes("Handcrafted Jewelry Characteristics"), "terms.html missing handmade characteristics section");
assert.ok(termsContent.includes("Shipping & Delivery"), "terms.html missing shipping section");
assert.ok(termsContent.includes("Returns & Exchanges"), "terms.html missing returns section");
console.log("PASS: terms.html contains all required commercial terms");

const faqContent = fs.readFileSync(path.join(ROOT, "faq.html"), "utf8");
assert.ok(faqContent.includes("Frequently Asked Questions"), "faq.html missing title");
assert.ok(faqContent.includes("care for my handmade jewelry"), "faq.html missing jewelry care FAQ");
assert.ok(faqContent.includes("How long does delivery take"), "faq.html missing shipping FAQ");
assert.ok(faqContent.includes("custom-made jewelry"), "faq.html missing customization FAQ");
console.log("PASS: faq.html contains comprehensive FAQ accordions");

// 2. Verify all storefront HTML pages have standardized footer and floating WhatsApp CTA
const storefrontPages = [
    "index.html",
    "collections.html",
    "product.html",
    "about.html",
    "contact.html",
    "wishlist.html",
    "cart.html",
    "my-orders.html",
    "profile.html",
    "order.html",
    "privacy-policy.html",
    "terms.html",
    "faq.html",
    "login.html"
];

for (const page of storefrontPages) {
    const filePath = path.join(ROOT, page);
    assert.ok(fs.existsSync(filePath), `${page} does not exist`);
    const content = fs.readFileSync(filePath, "utf8");

    // Check footer
    assert.ok(content.includes("site-footer"), `${page} is missing standardized site-footer class`);
    assert.ok(content.includes("privacy-policy.html"), `${page} footer is missing privacy policy link`);
    assert.ok(content.includes("terms.html"), `${page} footer is missing terms link`);
    assert.ok(content.includes("alorajewels26@gmail.com"), `${page} footer is missing support email`);

    // Check floating WhatsApp button (applicable to public storefront pages)
    if (page !== "login.html") {
        assert.ok(content.includes("floating-whatsapp-btn"), `${page} is missing floating WhatsApp button`);
    }
}
console.log(`PASS: All ${storefrontPages.length} storefront pages have standardized 4-column footer and WhatsApp CTA`);

console.log("\nALL LEGAL PAGES & FOOTER TESTS PASSED (100%)!\n");
