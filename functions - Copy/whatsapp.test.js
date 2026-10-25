/* eslint-disable require-jsdoc */

const assert = require("node:assert/strict");
const {
  buildAdminOrderUrl,
  formatOrderNotification,
  isNotificationSent,
  sendWhatsAppText,
} = require("./whatsapp");

const order = {
  customer: "Customer Name",
  products: "Necklace",
  quantity: 1,
  total: "₹1,499",
  payment: "Cash on Delivery",
};

const adminUrl = buildAdminOrderUrl(
    "https://shop.example/",
    "ALR-12345678",
    "customer uid",
);

assert.equal(
    adminUrl,
    "https://shop.example/admin.html?" +
    "orderId=ALR-12345678&userId=customer+uid",
);

const message = formatOrderNotification(
    order,
    "ALR-12345678",
    adminUrl,
);
assert.match(message, /New Alora Order/);
assert.match(message, /Customer: Customer Name/);
assert.match(message, /View full details:/);
console.log("PASS order notification and admin URL formatting");

const fallbackMessage = formatOrderNotification(
    {},
    "ALR-MISSING",
    adminUrl,
);
assert.match(
    fallbackMessage,
    /Customer: Customer unavailable/,
);
assert.match(
    fallbackMessage,
    /Product: Order items unavailable/,
);
console.log("PASS missing optional order fields use safe fallbacks");

assert.equal(
    isNotificationSent({status: "sent"}),
    true,
);
assert.equal(
    isNotificationSent({status: "failed"}),
    false,
);
console.log("PASS successful notification state skips duplicate events");

const requests = [];

(async function run() {
  await sendWhatsAppText({
    fetchImpl: async (url, options) => {
      requests.push({url, options});
      return {ok: true, status: 200};
    },
    accessToken: "test-token",
    phoneNumberId: "test-phone-id",
    recipient: "test-admin",
    message,
  });

  assert.equal(
      requests[0].url,
      "https://graph.facebook.com/v22.0/test-phone-id/messages",
  );
  assert.match(
      requests[0].options.headers.Authorization,
      /^Bearer test-token$/,
  );
  assert.equal(
      JSON.parse(requests[0].options.body).to,
      "test-admin",
  );
  console.log("PASS WhatsApp Cloud API request payload");

  await assert.rejects(
      sendWhatsAppText({
        fetchImpl: async () => ({ok: false, status: 500}),
        accessToken: "test-token",
        phoneNumberId: "test-phone-id",
        recipient: "test-admin",
        message,
      }),
      /status 500/,
  );
  console.log("PASS WhatsApp API failure is surfaced for retry");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
