const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "order-email.js"),
    "utf8"
);

function createMockEnvironment(overrides = {}) {
    const sessionStorageMap = new Map();
    const localStorageMap = new Map();

    const mockStorage = (map) => ({
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k)
    });

    const context = {
        console,
        sessionStorage: mockStorage(sessionStorageMap),
        localStorage: mockStorage(localStorageMap),
        Date,
        Number,
        String,
        JSON,
        Array,
        Promise,
        ...overrides
    };

    context.window = context;
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

const sampleOrder = {
    id: "ALR-99887766",
    products: "Kundal Gold Choker",
    quantity: 1,
    total: "₹2,499",
    payment: "Online Payment (UPI)",
    utr: "987654321098",
    customer: "Demo Customer",
    phone: "9999999999",
    email: "demo@example.com",
    address: "123 Demo Street, Bengaluru, Karnataka, 560001",
    date: "13 Sep 2026, 04:00 PM"
};

const sampleAdminUrl =
    "https://alora-handmade-jewelry.web.app/admin.html?orderId=ALR-99887766&userId=user-xyz";

// Test 1: Admin payload creation
const env1 = createMockEnvironment();
const adminPayload = env1.buildOrderEmailPayload(
    sampleOrder,
    sampleOrder.id,
    sampleAdminUrl
);

assert.equal(adminPayload.order_id, "ALR-99887766");
assert.equal(adminPayload.subject, "New Alora Order - Kundal Gold Choker");
assert.equal(adminPayload.customer_name, "Demo Customer");
assert.equal(adminPayload.customer_phone, "9999999999");
assert.equal(adminPayload.customer_email, "demo@example.com");
assert.equal(adminPayload.delivery_address, "123 Demo Street, Bengaluru, Karnataka, 560001");
assert.equal(adminPayload.products, "Kundal Gold Choker");
assert.equal(adminPayload.quantity, "1");
assert.equal(adminPayload.total, "₹2,499");
assert.equal(adminPayload.payment_method, "Online Payment (UPI)");
assert.equal(adminPayload.utr, "987654321098");
assert.equal(adminPayload.order_date, "13 Sep 2026, 04:00 PM");
assert.equal(adminPayload.admin_order_url, sampleAdminUrl);
console.log("PASS 1: buildOrderEmailPayload maps all required admin fields and link");

// Test 2: Customer payload creation
const custPayload = env1.buildCustomerEmailPayload(
    sampleOrder,
    sampleOrder.id
);

assert.equal(custPayload.order_id, "ALR-99887766");
assert.equal(custPayload.subject, "Your Alora Order Has Been Placed - ALR-99887766");
assert.equal(custPayload.to_email, "demo@example.com");
assert.equal(custPayload.recipient_email, "demo@example.com");
assert.equal(custPayload.customer_name, "Demo Customer");
assert.equal(custPayload.products, "Kundal Gold Choker");
assert.equal(custPayload.quantity, "1");
assert.equal(custPayload.total, "₹2,499");
assert.equal(custPayload.payment_method, "Online Payment (UPI)");
assert.equal(custPayload.utr, "987654321098");
assert.equal(custPayload.delivery_address, "123 Demo Street, Bengaluru, Karnataka, 560001");
assert.match(custPayload.support_note, /We have received your order successfully/);
assert.match(custPayload.support_note, /contact Alora support/);
assert.equal(custPayload.support_email, "alorajewels26@gmail.com");
assert.equal(custPayload.support_phone, "+91 9392159623");
assert.equal(custPayload.brand_name, "Alora Jewels");
console.log("PASS 2: buildCustomerEmailPayload maps customer confirmation fields, subject, and support info");

// Test 3: Email validation
assert.equal(env1.isValidCustomerEmail("customer@example.com"), true);
assert.equal(env1.isValidCustomerEmail("user.name+tag@domain.co.in"), true);
assert.equal(env1.isValidCustomerEmail(""), false);
assert.equal(env1.isValidCustomerEmail("invalid-email"), false);
assert.equal(env1.isValidCustomerEmail(null), false);
assert.equal(env1.isValidCustomerEmail(undefined), false);
console.log("PASS 3: isValidCustomerEmail correctly validates email formats");

(async function runTests() {
    // Test 4: Unconfigured placeholder skips without throwing
    const env2 = createMockEnvironment();
    const resultUnconfigured = await env2.sendOrderEmails(
        sampleOrder,
        sampleAdminUrl
    );
    assert.equal(resultUnconfigured.admin.skipped, true);
    assert.equal(resultUnconfigured.admin.reason, "unconfigured");
    assert.equal(resultUnconfigured.customer.skipped, true);
    assert.equal(resultUnconfigured.customer.reason, "unconfigured");
    console.log("PASS 4: unconfigured EmailJS settings skip gracefully with diagnostic message");

    // Test 5: Configured dispatcher sends BOTH admin and customer emails
    const requests = [];
    const env3 = createMockEnvironment({
        ALORA_EMAIL_CONFIG: {
            serviceId: "service_live",
            adminTemplateId: "template_admin_order",
            customerTemplateId: "template_customer_order",
            publicKey: "pk_live_user_123",
            endpoint: "https://api.emailjs.com/api/v1.0/email/send"
        }
    });

    const mockFetch = async (url, options) => {
        requests.push({ url, options });
        return {
            ok: true,
            status: 200,
            text: async () => "OK"
        };
    };

    const dualResult = await env3.sendOrderEmails(
        sampleOrder,
        sampleAdminUrl,
        { fetchImpl: mockFetch }
    );

    assert.equal(dualResult.admin.success, true);
    assert.equal(dualResult.customer.success, true);
    assert.equal(requests.length, 2, "sendOrderEmails must dispatch exactly 2 emails (Admin + Customer)");

    const adminBody = JSON.parse(requests[0].options.body);
    assert.equal(adminBody.service_id, "service_live");
    assert.equal(adminBody.template_id, "template_admin_order");
    assert.equal(adminBody.user_id, "pk_live_user_123");
    assert.equal(adminBody.template_params.order_id, "ALR-99887766");
    assert.equal(adminBody.template_params.admin_order_url, sampleAdminUrl);

    const custBody = JSON.parse(requests[1].options.body);
    assert.equal(custBody.service_id, "service_live");
    assert.equal(custBody.template_id, "template_customer_order");
    assert.equal(custBody.user_id, "pk_live_user_123");
    assert.equal(custBody.template_params.to_email, "demo@example.com");
    assert.equal(custBody.template_params.subject, "Your Alora Order Has Been Placed - ALR-99887766");
    console.log("PASS 5: configured EmailJS sends valid JSON requests for both Admin and Customer");

    // Test 6: Deduplication prevents duplicate sends for same order
    const resultDuplicate = await env3.sendOrderEmails(
        sampleOrder,
        sampleAdminUrl,
        { fetchImpl: mockFetch }
    );

    assert.equal(resultDuplicate.admin.skipped, true);
    assert.equal(resultDuplicate.admin.reason, "already_sent");
    assert.equal(resultDuplicate.customer.skipped, true);
    assert.equal(resultDuplicate.customer.reason, "already_sent");
    assert.equal(requests.length, 2, "Duplicate send must NOT trigger additional fetch requests");
    console.log("PASS 6: deduplication prevents repeat emails for both admin and customer");

    // Test 7: Invalid customer email skips customer email but sends admin email
    const env4 = createMockEnvironment({
        ALORA_EMAIL_CONFIG: {
            serviceId: "service_live",
            adminTemplateId: "template_admin_order",
            customerTemplateId: "template_customer_order",
            publicKey: "pk_live_user_123"
        }
    });

    const requestsInvalid = [];
    const mockFetch4 = async (url, options) => {
        requestsInvalid.push({ url, options });
        return { ok: true, status: 200, text: async () => "OK" };
    };

    const invalidEmailOrder = {
        ...sampleOrder,
        id: "ALR-NO-EMAIL",
        email: "not-an-email"
    };

    const partialResult = await env4.sendOrderEmails(
        invalidEmailOrder,
        sampleAdminUrl,
        { fetchImpl: mockFetch4 }
    );

    assert.equal(partialResult.admin.success, true);
    assert.equal(partialResult.customer.skipped, true);
    assert.equal(partialResult.customer.reason, "invalid_customer_email");
    assert.equal(requestsInvalid.length, 1, "Only admin email should be sent when customer email is invalid");
    console.log("PASS 7: invalid customer email skips customer send without failing admin notification");

    // Test 8: API failure in customer email does not crash or throw
    const env5 = createMockEnvironment({
        ALORA_EMAIL_CONFIG: {
            serviceId: "service_live",
            adminTemplateId: "template_admin_order",
            customerTemplateId: "template_customer_order",
            publicKey: "pk_live_user_123"
        }
    });

    let callCount = 0;
    const intermittentFetch = async () => {
        callCount++;
        if (callCount === 2) {
            return { ok: false, status: 500, text: async () => "EmailJS Down" };
        }
        return { ok: true, status: 200, text: async () => "OK" };
    };

    const resilientResult = await env5.sendOrderEmails(
        { ...sampleOrder, id: "ALR-RESILIENT" },
        sampleAdminUrl,
        { fetchImpl: intermittentFetch }
    );

    assert.equal(resilientResult.admin.success, true);
    assert.equal(resilientResult.customer.success, false);
    assert.match(resilientResult.customer.error, /HTTP 500/);
    console.log("PASS 8: failure in one email is caught safely and does not affect the other email");

    // Test 9: Production EmailJS configuration credentials validation
    const prodRequests = [];
    const envProd = createMockEnvironment({
        ALORA_EMAIL_CONFIG: {
            serviceId: "service_alora_orders",
            adminTemplateId: "template_akp8jpm",
            customerTemplateId: "template_5d30dsi",
            publicKey: "00wPV9AVw4H_OsF63"
        }
    });

    const prodFetch = async (url, options) => {
        prodRequests.push({ url, options, body: JSON.parse(options.body) });
        return { ok: true, status: 200, text: async () => "OK" };
    };

    const prodResult = await envProd.sendOrderEmails(
        { ...sampleOrder, id: "ALR-PROD-TEST" },
        sampleAdminUrl,
        { fetchImpl: prodFetch }
    );

    assert.equal(prodResult.admin.success, true);
    assert.equal(prodResult.customer.success, true);
    assert.equal(prodRequests.length, 2);

    // Admin request verification
    assert.equal(prodRequests[0].body.service_id, "service_alora_orders");
    assert.equal(prodRequests[0].body.template_id, "template_akp8jpm");
    assert.equal(prodRequests[0].body.user_id, "00wPV9AVw4H_OsF63");
    assert.equal(prodRequests[0].body.template_params.order_id, "ALR-PROD-TEST");

    // Customer request verification
    assert.equal(prodRequests[1].body.service_id, "service_alora_orders");
    assert.equal(prodRequests[1].body.template_id, "template_5d30dsi");
    assert.equal(prodRequests[1].body.user_id, "00wPV9AVw4H_OsF63");
    assert.equal(prodRequests[1].body.template_params.to_email, "demo@example.com");
    assert.equal(prodRequests[1].body.template_params.order_id, "ALR-PROD-TEST");
    assert.equal(prodRequests[1].body.template_params.support_email, "alorajewels26@gmail.com");
    console.log("PASS 9: production EmailJS configuration dispatches correctly with valid serviceId, template IDs, and publicKey");

    // Test 10: Admin URL sanitization from 127.0.0.1
    const localPayload1 = envProd.buildOrderEmailPayload(
        { ...sampleOrder, id: "ALR-SAN-1", userId: "user-local-1" },
        "ALR-SAN-1",
        "http://127.0.0.1:5500/admin.html?orderId=ALR-SAN-1&userId=user-local-1"
    );
    assert.equal(localPayload1.admin_order_url.includes("127.0.0.1"), false, "admin_order_url must NOT contain 127.0.0.1");
    assert.equal(localPayload1.admin_order_url.includes("localhost"), false, "admin_order_url must NOT contain localhost");
    assert.ok(
        localPayload1.admin_order_url.startsWith("https://alora-handmade-jewelry.web.app/admin.html"),
        "admin_order_url must start with https://alora-handmade-jewelry.web.app/admin.html"
    );
    assert.equal(
        localPayload1.admin_order_url,
        "https://alora-handmade-jewelry.web.app/admin.html?orderId=ALR-SAN-1&userId=user-local-1"
    );
    console.log("PASS 10: buildOrderEmailPayload sanitizes 127.0.0.1 URL to https://alora-handmade-jewelry.web.app");

    // Test 11: Admin URL sanitization from localhost
    const localPayload2 = envProd.buildOrderEmailPayload(
        { ...sampleOrder, id: "ALR-SAN-2", userId: "user-local-2" },
        "ALR-SAN-2",
        "http://localhost:3000/admin.html?orderId=ALR-SAN-2&userId=user-local-2"
    );
    assert.equal(localPayload2.admin_order_url.includes("localhost"), false, "admin_order_url must NOT contain localhost");
    assert.equal(localPayload2.admin_order_url.includes("127.0.0.1"), false, "admin_order_url must NOT contain 127.0.0.1");
    assert.ok(
        localPayload2.admin_order_url.startsWith("https://alora-handmade-jewelry.web.app/admin.html"),
        "admin_order_url must start with https://alora-handmade-jewelry.web.app/admin.html"
    );
    assert.equal(
        localPayload2.admin_order_url,
        "https://alora-handmade-jewelry.web.app/admin.html?orderId=ALR-SAN-2&userId=user-local-2"
    );
    console.log("PASS 11: buildOrderEmailPayload sanitizes localhost URL to https://alora-handmade-jewelry.web.app");

    // Test 12: sendOrderEmails with localhost adminUrl ensures EmailJS payload has production URL
    const localEmailRequests = [];
    const localResult = await envProd.sendOrderEmails(
        { ...sampleOrder, id: "ALR-LOCAL-DISPATCH", userId: "user-loc-dispatch" },
        "http://127.0.0.1:5500/admin.html?orderId=ALR-LOCAL-DISPATCH&userId=user-loc-dispatch",
        {
            fetchImpl: async (url, options) => {
                localEmailRequests.push({ url, body: JSON.parse(options.body) });
                return { ok: true, status: 200, text: async () => "OK" };
            }
        }
    );
    assert.equal(localResult.admin.success, true);
    assert.equal(localEmailRequests.length, 2);
    const sentAdminUrl = localEmailRequests[0].body.template_params.admin_order_url;
    assert.equal(sentAdminUrl.includes("127.0.0.1"), false, "Sent email must NOT contain 127.0.0.1");
    assert.equal(sentAdminUrl.includes("localhost"), false, "Sent email must NOT contain localhost");
    assert.ok(
        sentAdminUrl.startsWith("https://alora-handmade-jewelry.web.app/admin.html"),
        "Sent email must start with https://alora-handmade-jewelry.web.app/admin.html"
    );
    assert.equal(
        sentAdminUrl,
        "https://alora-handmade-jewelry.web.app/admin.html?orderId=ALR-LOCAL-DISPATCH&userId=user-loc-dispatch"
    );
    console.log("PASS 12: sendOrderEmails dispatches production admin_order_url even when called from local dev");

    console.log("\nALL 12 TESTS PASSED IN order-email.test.js!");
})().catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
});

