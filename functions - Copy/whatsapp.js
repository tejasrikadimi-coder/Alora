/* eslint-disable require-jsdoc */

const ALORA_PRODUCTION_URL = "https://alora-handmade-jewelry.web.app";

function buildAdminOrderUrl(siteUrl, orderId, userId) {
  let baseUrl = String(siteUrl || "").trim();

  if (!baseUrl || baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost")) {
    baseUrl = ALORA_PRODUCTION_URL;
  }

  const adminUrl = new URL(
      "admin.html",
      baseUrl.endsWith("/") ? baseUrl : baseUrl + "/",
  );

  if (orderId) {
    adminUrl.searchParams.set("orderId", String(orderId).trim());
  }
  if (userId) {
    adminUrl.searchParams.set("userId", String(userId).trim());
  }

  return adminUrl.toString();
}

function getOrderProductSummary(order) {
  if (order.products) {
    return String(order.products);
  }

  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.map((item) => String(item.name || "Item")).join(", ");
  }

  return "Order items unavailable";
}

function getOrderQuantity(order) {
  const quantity = Number(order.quantity);

  if (Number.isInteger(quantity) && quantity > 0) {
    return String(quantity);
  }

  if (Array.isArray(order.items)) {
    const itemQuantity = order.items.reduce(
        (total, item) => total + (Number(item.quantity) || 0),
        0,
    );

    if (itemQuantity > 0) {
      return String(itemQuantity);
    }
  }

  return "Not provided";
}

function formatOrderNotification(order, orderId, adminUrl) {
  return [
    "New Alora Order",
    "",
    `Order ID: ${orderId || "Not provided"}`,
    `Customer: ${order.customer || "Customer unavailable"}`,
    `Product: ${getOrderProductSummary(order)}`,
    `Quantity: ${getOrderQuantity(order)}`,
    `Total: ${order.total || "Not provided"}`,
    `Payment: ${order.payment || "Not provided"}`,
    `Payment status: ${order.paymentStatus || "Not provided"}`,
    "",
    "View full details:",
    adminUrl,
  ].join("\n");
}

function createWhatsAppTextPayload(recipient, message) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: {
      preview_url: true,
      body: message,
    },
  };
}

function isNotificationSent(notification) {
  return Boolean(
      notification &&
      notification.status === "sent",
  );
}

async function sendWhatsAppText({
  fetchImpl,
  accessToken,
  phoneNumberId,
  recipient,
  message,
}) {
  const endpoint =
    `https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}/messages`;

  const response = await fetchImpl(
      endpoint,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
            createWhatsAppTextPayload(recipient, message),
        ),
      },
  );

  if (!response.ok) {
    throw new Error(
        `WhatsApp API request failed with status ${response.status}.`,
    );
  }
}

module.exports = {
  buildAdminOrderUrl,
  formatOrderNotification,
  isNotificationSent,
  sendWhatsAppText,
};
