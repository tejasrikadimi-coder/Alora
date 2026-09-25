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

function formatOrderEmailSubject(order, orderId) {
  const product = getOrderProductSummary(order);
  const identifier = product !== "Order items unavailable" ? product : orderId;
  return `New Alora Order - ${identifier || "New Order"}`;
}

function formatOrderEmailText(order, orderId, adminUrl) {
  const lines = [
    "New Alora Order Received!",
    "=========================",
    "",
    `Order ID: ${orderId || "Not provided"}`,
    `Order Date/Time: ${order.date || "Not provided"}`,
    "",
    "Customer Information:",
    `  Name: ${order.customer || "Customer unavailable"}`,
    `  Phone: ${order.phone || "Not provided"}`,
    `  Email: ${order.email || "Not provided"}`,
    `  Delivery Address: ${order.address || "Not provided"}`,
    "",
    "Order Details:",
    `  Products: ${getOrderProductSummary(order)}`,
    `  Quantity: ${getOrderQuantity(order)}`,
    `  Total Amount: ${order.total || "Not provided"}`,
    `  Payment Method: ${order.payment || "Not provided"}`,
  ];

  if (order.utr) {
    lines.push(`  UPI UTR / Ref: ${order.utr}`);
  }

  lines.push("");
  lines.push("View Order in Admin Dashboard:");
  lines.push(adminUrl);

  return lines.join("\n");
}

function escapeHtml(text) {
  return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

function formatOrderEmailHtml(order, orderId, adminUrl) {
  const customer = escapeHtml(order.customer || "Customer unavailable");
  const phone = escapeHtml(order.phone || "Not provided");
  const email = escapeHtml(order.email || "Not provided");
  const address = escapeHtml(order.address || "Not provided");
  const products = escapeHtml(getOrderProductSummary(order));
  const quantity = escapeHtml(getOrderQuantity(order));
  const total = escapeHtml(order.total || "Not provided");
  const payment = escapeHtml(order.payment || "Not provided");
  const date = escapeHtml(order.date || "Not provided");
  const utrRow = order.utr ?
    [
      "<tr>",
      "  <td style=\"padding: 8px 12px; font-weight: 600; color: #555;\">" +
        "UPI UTR / Ref:</td>",
      `  <td style="padding: 8px 12px; color: #222;">` +
        `${escapeHtml(order.utr)}</td>`,
      "</tr>",
    ].join("\n") :
    "";

  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <title>New Alora Order</title>",
    "</head>",
    "<body style=\"font-family: Arial, sans-serif; background: #faf7f2; " +
      "color: #222; margin: 0; padding: 25px;\">",
    "  <div style=\"max-width: 600px; margin: auto; background: #fff; " +
      "border: 1px solid #e8dfd2; border-radius: 6px; overflow: hidden;\">",
    "    <div style=\"background: #b68b00; padding: 22px; " +
      "text-align: center; color: #fff;\">",
    "      <h1 style=\"margin: 0; font-size: 24px; letter-spacing: 2px;\">" +
      "ALORA</h1>",
    "      <p style=\"margin: 6px 0 0; font-size: 13px;\">" +
      "New Order Received</p>",
    "    </div>",
    "    <div style=\"padding: 22px;\">",
    "      <p style=\"margin-top: 0;\">A new order was placed on " +
      "<strong>Alora Handmade Jewelry</strong>.</p>",
    "      <table style=\"width: 100%; border-collapse: collapse; " +
      "margin: 18px 0; font-size: 14px; background: #faf7f2; " +
      "border: 1px solid #e8dfd2;\">",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555; width: 35%;\">Order ID:</td>",
    "          <td style=\"padding: 8px 12px; color: #b68b00; " +
      `font-weight: bold;">${escapeHtml(orderId)}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Order Date:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${date}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Customer Name:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${customer}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Phone:</td>",
    "          <td style=\"padding: 8px 12px; color: #222;\">" +
      `<a href="tel:${phone}" style="color: #b68b00;">${phone}</a></td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Email:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${email}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Delivery Address:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${address}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Products:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${products}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Total Quantity:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${quantity}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Total Amount:</td>",
    "          <td style=\"padding: 8px 12px; color: #b68b00; " +
      `font-size: 16px; font-weight: bold;">${total}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Payment Method:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${payment}</td>`,
    "        </tr>",
    utrRow,
    "      </table>",
    "      <div style=\"text-align: center; margin: 28px 0 14px;\">",
    `        <a href="${escapeHtml(adminUrl)}" ` +
      "style=\"display: inline-block; background: #b68b00; color: #fff; " +
      "padding: 13px 26px; text-decoration: none; font-weight: 600; " +
      "border-radius: 4px;\">View Order in Dashboard</a>",
    "      </div>",
    "      <p style=\"font-size: 12px; color: #888; text-align: center;\">" +
      `Direct link: <a href="${escapeHtml(adminUrl)}" ` +
      `style="color: #b68b00;">${escapeHtml(adminUrl)}</a></p>`,
    "    </div>",
    "  </div>",
    "</body>",
    "</html>",
  ].filter(Boolean).join("\n");
}

function isEmailNotificationSent(notification) {
  return Boolean(
      notification &&
      (notification.emailSent === true ||
       notification.status === "email_sent" ||
       notification.adminEmailSent === true),
  );
}

function isCustomerEmailNotificationSent(notification) {
  return Boolean(
      notification &&
      (notification.customerEmailSent === true ||
       notification.customerStatus === "email_sent"),
  );
}

function formatCustomerEmailSubject(orderId) {
  const id = String(orderId || "").trim();
  return `Your Alora Order Has Been Placed - ${id || "Confirmation"}`;
}

function formatCustomerEmailText(order, orderId) {
  const customer = order.customer || "Valued Customer";
  const lines = [
    "Thank You for Ordering with Alora Jewels!",
    "=========================================",
    "",
    `Dear ${customer},`,
    "",
    "We have received your order successfully. We will contact you if " +
      "any additional information is needed.",
    "",
    "Order Summary:",
    `  Order ID: ${orderId || "Not provided"}`,
    `  Order Date: ${order.date || "Not provided"}`,
    `  Products: ${getOrderProductSummary(order)}`,
    `  Quantity: ${getOrderQuantity(order)}`,
    `  Total Amount: ${order.total || "Not provided"}`,
    `  Payment Method: ${order.payment || "Not provided"}`,
  ];

  if (order.utr) {
    lines.push(`  UPI UTR / Ref: ${order.utr}`);
  }

  lines.push(`  Delivery Address: ${order.address || "Not provided"}`);
  lines.push("");
  lines.push("Support Contact Details:");
  lines.push("  Brand: Alora Jewels / Alora Handmade Jewelry");
  lines.push("  Support Email: alorajewels26@gmail.com");
  lines.push("  Phone / WhatsApp: +91 9392159623");
  lines.push("");
  lines.push("Warm regards,");
  lines.push("Alora Jewels");

  return lines.join("\n");
}

function formatCustomerEmailHtml(order, orderId) {
  const customer = escapeHtml(order.customer || "Valued Customer");
  const phone = escapeHtml(order.phone || "Not provided");
  const email = escapeHtml(order.email || "Not provided");
  const address = escapeHtml(order.address || "Not provided");
  const products = escapeHtml(getOrderProductSummary(order));
  const quantity = escapeHtml(getOrderQuantity(order));
  const total = escapeHtml(order.total || "Not provided");
  const payment = escapeHtml(order.payment || "Not provided");
  const date = escapeHtml(order.date || "Not provided");
  const utrRow = order.utr ?
    [
      "        <tr>",
      "          <td style=\"padding: 8px 12px; font-weight: 600; " +
        "color: #555;\">UPI UTR / Ref:</td>",
      `          <td style="padding: 8px 12px; color: #222;">` +
        `${escapeHtml(order.utr)}</td>`,
      "        </tr>",
    ].join("\n") :
    "";

  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <title>Your Alora Order Confirmation</title>",
    "</head>",
    "<body style=\"font-family: Arial, sans-serif; background: #faf7f2; " +
      "color: #222; margin: 0; padding: 25px;\">",
    "  <div style=\"max-width: 600px; margin: auto; background: #fff; " +
      "border: 1px solid #e8dfd2; border-radius: 6px; overflow: hidden;\">",
    "    <div style=\"background: #b68b00; padding: 22px; " +
      "text-align: center; color: #fff;\">",
    "      <h1 style=\"margin: 0; font-size: 24px; letter-spacing: 2px;\">" +
      "ALORA JEWELS</h1>",
    "      <p style=\"margin: 6px 0 0; font-size: 13px;\">" +
      "Order Confirmation</p>",
    "    </div>",
    "    <div style=\"padding: 22px;\">",
    "      <h2 style=\"font-size: 18px; color: #333; margin-top: 0;\">" +
      "Thank you for ordering with Alora Jewels!</h2>",
    "      <p style=\"font-size: 14px; color: #444; line-height: 1.5;\">" +
      `Dear ${customer},<br>`,
    "      We have received your order successfully. We will contact you if " +
      "any additional information is needed. For any questions, contact " +
      "Alora support.</p>",
    "      <table style=\"width: 100%; border-collapse: collapse; " +
      "margin: 18px 0; font-size: 14px; background: #faf7f2; " +
      "border: 1px solid #e8dfd2;\">",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555; width: 35%;\">Order ID:</td>",
    "          <td style=\"padding: 8px 12px; color: #b68b00; " +
      `font-weight: bold;">${escapeHtml(orderId)}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Order Date:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${date}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Customer Name:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${customer}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Phone:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${phone}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Email:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${email}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Delivery Address:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${address}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Products:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${products}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Total Quantity:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${quantity}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Total Amount:</td>",
    "          <td style=\"padding: 8px 12px; color: #b68b00; " +
      `font-size: 16px; font-weight: bold;">${total}</td>`,
    "        </tr>",
    "        <tr>",
    "          <td style=\"padding: 8px 12px; font-weight: 600; " +
      "color: #555;\">Payment Method:</td>",
    `          <td style="padding: 8px 12px; color: #222;">${payment}</td>`,
    "        </tr>",
    utrRow,
    "      </table>",
    "      <div style=\"background: #faf7f2; border: 1px solid #e8dfd2; " +
      "border-radius: 4px; padding: 14px 18px; margin-top: 20px;\">",
    "        <h3 style=\"font-size: 14px; margin: 0 0 8px; color: #555;\">" +
      "Alora Support Details</h3>",
    "        <p style=\"font-size: 13px; margin: 4px 0; color: #444;\">" +
      "Brand: <strong>Alora Jewels / Alora Handmade Jewelry</strong></p>",
    "        <p style=\"font-size: 13px; margin: 4px 0; color: #444;\">" +
      "Email: <a href=\"mailto:alorajewels26@gmail.com\" " +
      "style=\"color: #b68b00;\">alorajewels26@gmail.com</a></p>",
    "        <p style=\"font-size: 13px; margin: 4px 0; color: #444;\">" +
      "Phone / WhatsApp: <a href=\"tel:+919392159623\" " +
      "style=\"color: #b68b00;\">+91 9392159623</a></p>",
    "      </div>",
    "    </div>",
    "  </div>",
    "</body>",
    "</html>",
  ].filter(Boolean).join("\n");
}

async function sendAdminOrderEmail({
  fetchImpl,
  apiKey,
  from,
  to,
  order,
  orderId,
  adminUrl,
}) {
  const subject = formatOrderEmailSubject(order, orderId);
  const text = formatOrderEmailText(order, orderId, adminUrl);
  const html = formatOrderEmailHtml(order, orderId, adminUrl);

  const endpoint = "https://api.resend.com/emails";
  const defaultFrom = "Alora Orders <onboarding@resend.dev>";
  const fromAddress = String(from || defaultFrom).trim();
  const toAddress = Array.isArray(to) ? to : [String(to).trim()];

  const response = await fetchImpl(
      endpoint,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: toAddress,
          subject,
          text,
          html,
        }),
      },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
        `Resend API request failed with status ${response.status}: ` +
        errorBody,
    );
  }

  return response.json().catch(() => ({success: true}));
}

async function sendCustomerOrderEmail({
  fetchImpl,
  apiKey,
  from,
  to,
  order,
  orderId,
}) {
  const customerEmail = String(to || (order && order.email) || "").trim();
  if (!customerEmail || !customerEmail.includes("@")) {
    throw new Error("Valid customer email address is required.");
  }

  const subject = formatCustomerEmailSubject(orderId);
  const text = formatCustomerEmailText(order, orderId);
  const html = formatCustomerEmailHtml(order, orderId);

  const endpoint = "https://api.resend.com/emails";
  const defaultFrom = "Alora Orders <onboarding@resend.dev>";
  const fromAddress = String(from || defaultFrom).trim();
  const toAddress = [customerEmail];

  const response = await fetchImpl(
      endpoint,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: toAddress,
          subject,
          text,
          html,
        }),
      },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
        `Resend customer email failed with status ${response.status}: ` +
        errorBody,
    );
  }

  return response.json().catch(() => ({success: true}));
}

module.exports = {
  ALORA_PRODUCTION_URL,
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
};
