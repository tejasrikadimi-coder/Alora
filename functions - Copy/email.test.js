/* eslint-disable require-jsdoc */

const assert = require("node:assert/strict");
const {
  buildAdminOrderUrl,
  formatOrderEmailSubject,
  formatOrderEmailText,
  formatOrderEmailHtml,
  formatCustomerEmailSubject,
  formatCustomerEmailText,
  formatCustomerEmailHtml,
  isEmailNotificationSent,
  isCustomerEmailNotificationSent,
  sendAdminOrderEmail,
  sendCustomerOrderEmail,
} = require("./email");

const order = {
  customer: "Priya Sharma",
  phone: "9876543210",
  email: "priya@example.com",
  address: "Flat 402, Lotus Residency, Hyderabad, 500081",
  products: "Lotus Neckset",
  quantity: 2,
  total: "₹1,998",
  payment: "Online Payment (UPI)",
  utr: "123456789012",
  date: "13 Sep 2026, 03:30 PM",
};

const adminUrl = buildAdminOrderUrl(
    "https://alora-handmade-jewelry.web.app/",
    "ALR-12345678",
    "customer-uid-99",
);

assert.equal(adminUrl.includes("127.0.0.1"), false);
assert.equal(adminUrl.includes("localhost"), false);
assert.ok(adminUrl.startsWith("https://alora-handmade-jewelry.web.app/admin.html"));

assert.equal(
    adminUrl,
    "https://alora-handmade-jewelry.web.app/admin.html?" +
    "orderId=ALR-12345678&userId=customer-uid-99",
);

// Verify backend buildAdminOrderUrl sanitizes local development URLs
const sanitizedLocal = buildAdminOrderUrl(
    "http://127.0.0.1:5000",
    "ALR-9999",
    "uid-999",
);
assert.equal(sanitizedLocal.includes("127.0.0.1"), false);
assert.equal(sanitizedLocal.includes("localhost"), false);
assert.ok(sanitizedLocal.startsWith("https://alora-handmade-jewelry.web.app/admin.html"));
assert.equal(
    sanitizedLocal,
    "https://alora-handmade-jewelry.web.app/admin.html?orderId=ALR-9999&userId=uid-999",
);

console.log("PASS buildAdminOrderUrl matches admin dashboard requirements and rejects localhost/127.0.0.1");

const subject = formatOrderEmailSubject(order, "ALR-12345678");
assert.equal(subject, "New Alora Order - Lotus Neckset");

const fallbackSubject = formatOrderEmailSubject({}, "ALR-12345678");
assert.equal(fallbackSubject, "New Alora Order - ALR-12345678");
console.log("PASS subject formatting with product name and order ID fallback");

const text = formatOrderEmailText(order, "ALR-12345678", adminUrl);
assert.match(text, /New Alora Order Received!/);
assert.match(text, /Order ID: ALR-12345678/);
assert.match(text, /Name: Priya Sharma/);
assert.match(text, /Phone: 9876543210/);
assert.match(text, /Email: priya@example\.com/);
assert.match(text, /Delivery Address: Flat 402, Lotus Residency/);
assert.match(text, /Products: Lotus Neckset/);
assert.match(text, /Quantity: 2/);
assert.match(text, /Total Amount: ₹1,998/);
assert.match(text, /Payment Method: Online Payment \(UPI\)/);
assert.match(text, /UPI UTR \/ Ref: 123456789012/);
assert.match(text, new RegExp(adminUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
console.log("PASS plain text email body includes all required order fields");

const html = formatOrderEmailHtml(order, "ALR-12345678", adminUrl);
assert.match(html, /ALR-12345678/);
assert.match(html, /Priya Sharma/);
assert.match(html, /9876543210/);
assert.match(html, /priya@example\.com/);
assert.match(html, /Lotus Neckset/);
assert.match(html, /₹1,998/);
assert.match(html, /123456789012/);
assert.match(html, /View Order in Dashboard/);
assert.match(html, /orderId=ALR-12345678/);
assert.match(html, /userId=customer-uid-99/);
console.log("PASS HTML email body formatting and dashboard link");

// Customer Email Formatter Tests
const custSubject = formatCustomerEmailSubject("ALR-12345678");
assert.equal(custSubject, "Your Alora Order Has Been Placed - ALR-12345678");
console.log("PASS formatCustomerEmailSubject matches required format");

const custText = formatCustomerEmailText(order, "ALR-12345678");
assert.match(custText, /Thank You for Ordering with Alora Jewels!/);
assert.match(custText, /Dear Priya Sharma/);
assert.match(custText, /Order ID: ALR-12345678/);
assert.match(custText, /Products: Lotus Neckset/);
assert.match(custText, /Total Amount: ₹1,998/);
assert.match(custText, /Payment Method: Online Payment \(UPI\)/);
assert.match(custText, /UPI UTR \/ Ref: 123456789012/);
assert.match(custText, /alorajewels26@gmail\.com/);
assert.match(custText, /\+91 9392159623/);
console.log("PASS formatCustomerEmailText formatted successfully");

const custHtml = formatCustomerEmailHtml(order, "ALR-12345678");
assert.match(custHtml, /ALORA JEWELS/);
assert.match(custHtml, /Thank you for ordering with Alora Jewels!/);
assert.match(custHtml, /Priya Sharma/);
assert.match(custHtml, /ALR-12345678/);
assert.match(custHtml, /Lotus Neckset/);
assert.match(custHtml, /₹1,998/);
assert.match(custHtml, /123456789012/);
assert.match(custHtml, /alorajewels26@gmail\.com/);
assert.match(custHtml, /\+91 9392159623/);
console.log("PASS formatCustomerEmailHtml formatted with branding");

assert.equal(isEmailNotificationSent({emailSent: true}), true);
assert.equal(isEmailNotificationSent({adminEmailSent: true}), true);
assert.equal(isEmailNotificationSent({status: "email_sent"}), true);
assert.equal(isEmailNotificationSent({status: "sent"}), false);
assert.equal(isEmailNotificationSent(null), false);

assert.equal(
    isCustomerEmailNotificationSent({customerEmailSent: true}),
    true,
);
assert.equal(
    isCustomerEmailNotificationSent({customerStatus: "email_sent"}),
    true,
);
assert.equal(isCustomerEmailNotificationSent({status: "sent"}), false);
assert.equal(isCustomerEmailNotificationSent(null), false);
console.log("PASS email deduplication state detection for admin and customer");

const requests = [];

(async function run() {
  await sendAdminOrderEmail({
    fetchImpl: async (url, options) => {
      requests.push({url, options});
      return {
        ok: true,
        status: 200,
        json: async () => ({id: "resend-msg-123"}),
      };
    },
    apiKey: "re_test_api_key",
    from: "Alora Orders <onboarding@resend.dev>",
    to: "admin@alorahandmade.com",
    order,
    orderId: "ALR-12345678",
    adminUrl,
  });

  assert.equal(requests[0].url, "https://api.resend.com/emails");
  assert.equal(
      requests[0].options.headers.Authorization,
      "Bearer re_test_api_key",
  );
  const payload = JSON.parse(requests[0].options.body);
  assert.deepEqual(payload.to, ["admin@alorahandmade.com"]);
  assert.equal(payload.subject, "New Alora Order - Lotus Neckset");
  assert.match(payload.text, /ALR-12345678/);
  assert.match(payload.html, /ALR-12345678/);
  console.log("PASS Resend Admin API payload and authorization header");

  // Test Customer Resend Dispatch
  await sendCustomerOrderEmail({
    fetchImpl: async (url, options) => {
      requests.push({url, options});
      return {
        ok: true,
        status: 200,
        json: async () => ({id: "resend-msg-customer-456"}),
      };
    },
    apiKey: "re_test_api_key",
    order,
    orderId: "ALR-12345678",
  });

  assert.equal(requests.length, 2);
  const custRequest = JSON.parse(requests[1].options.body);
  assert.deepEqual(custRequest.to, ["priya@example.com"]);
  assert.equal(
      custRequest.subject,
      "Your Alora Order Has Been Placed - ALR-12345678",
  );
  assert.match(custRequest.text, /Dear Priya Sharma/);
  assert.match(custRequest.html, /alorajewels26@gmail\.com/);
  console.log("PASS Resend Customer confirmation API payload and recipient");

  await assert.rejects(
      sendCustomerOrderEmail({
        fetchImpl: async () => ({ok: true}),
        apiKey: "re_test_api_key",
        order: {...order, email: "invalid"},
        orderId: "ALR-12345678",
      }),
      /Valid customer email address is required/,
  );
  console.log("PASS Resend Customer email rejects invalid customer email");

  await assert.rejects(
      sendAdminOrderEmail({
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          text: async () => "Unauthorized API key",
        }),
        apiKey: "invalid_key",
        to: "admin@alorahandmade.com",
        order,
        orderId: "ALR-12345678",
        adminUrl,
      }),
      /status 401: Unauthorized API key/,
  );
  console.log("PASS Resend API error reporting");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
