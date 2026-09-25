/* =====================================================
   ALORA HANDMADE JEWELRY
   ORDER EMAIL NOTIFICATION DISPATCHER (ADMIN + CUSTOMER)
   ===================================================== */

(function (window) {
    "use strict";

    /**
     * EmailJS configuration for client-side order notifications.
     * Note: EmailJS Public Key is safe for client-side use (it is a public
     * identifier, not a secret). Recipient addresses and template contents
     * are configured in your EmailJS Dashboard.
     *
     * Dual Templates:
     * 1. adminTemplateId: Sends order notification to admin.
     * 2. customerTemplateId: Sends confirmation to customer (using {{to_email}} parameter).
     */
    const DEFAULT_CONFIG = {
        serviceId: "service_alora_orders",
        adminTemplateId: "template_alora_order",
        customerTemplateId: "template_alora_customer_order",
        publicKey: "your_emailjs_public_key",
        endpoint: "https://api.emailjs.com/api/v1.0/email/send",
        brandName: "Alora Jewels",
        supportEmail: "alorajewels26@gmail.com",
        supportPhone: "+91 9392159623"
    };

    function getEmailConfig() {
        const custom = (typeof window !== "undefined" && window.ALORA_EMAIL_CONFIG) ? window.ALORA_EMAIL_CONFIG : {};
        const adminTpl = custom.adminTemplateId || custom.templateId || DEFAULT_CONFIG.adminTemplateId;
        const custTpl = custom.customerTemplateId || DEFAULT_CONFIG.customerTemplateId;

        return {
            serviceId: String(custom.serviceId || DEFAULT_CONFIG.serviceId).trim(),
            adminTemplateId: String(adminTpl).trim(),
            templateId: String(adminTpl).trim(), // backward-compatibility alias
            customerTemplateId: String(custTpl).trim(),
            publicKey: String(custom.publicKey || DEFAULT_CONFIG.publicKey).trim(),
            endpoint: String(custom.endpoint || DEFAULT_CONFIG.endpoint).trim(),
            brandName: String(custom.brandName || DEFAULT_CONFIG.brandName).trim(),
            supportEmail: String(custom.supportEmail || DEFAULT_CONFIG.supportEmail).trim(),
            supportPhone: String(custom.supportPhone || DEFAULT_CONFIG.supportPhone).trim()
        };
    }

    function getStorage(type) {
        try {
            if (typeof window !== "undefined" && window[type]) {
                return window[type];
            }
            if (typeof globalThis !== "undefined" && globalThis[type]) {
                return globalThis[type];
            }
        } catch (e) {}
        return null;
    }

    function isValidCustomerEmail(email) {
        if (!email || typeof email !== "string") {
            return false;
        }
        const trimmed = email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(trimmed);
    }

    /* ---- ADMIN EMAIL DEDUPLICATION ---- */

    function isOrderEmailAlreadySent(orderId) {
        if (!orderId) {
            return false;
        }

        const keys = [
            "alora_admin_email_sent_" + orderId,
            "alora_email_sent_" + orderId
        ];
        const session = getStorage("sessionStorage");
        const local = getStorage("localStorage");

        try {
            for (let i = 0; i < keys.length; i++) {
                if (session && session.getItem(keys[i])) {
                    return true;
                }
                if (local && local.getItem(keys[i])) {
                    return true;
                }
            }
        } catch (e) {}

        return false;
    }

    function markOrderEmailSent(orderId) {
        if (!orderId) {
            return;
        }

        const key = "alora_admin_email_sent_" + orderId;
        const legacyKey = "alora_email_sent_" + orderId;
        const timestamp = new Date().toISOString();
        const session = getStorage("sessionStorage");
        const local = getStorage("localStorage");

        try {
            if (session) {
                session.setItem(key, timestamp);
                session.setItem(legacyKey, timestamp);
            }
            if (local) {
                local.setItem(key, timestamp);
                local.setItem(legacyKey, timestamp);
            }
        } catch (e) {}
    }

    /* ---- CUSTOMER EMAIL DEDUPLICATION ---- */

    function isCustomerEmailAlreadySent(orderId) {
        if (!orderId) {
            return false;
        }

        const key = "alora_customer_email_sent_" + orderId;
        const session = getStorage("sessionStorage");
        const local = getStorage("localStorage");

        try {
            if (session && session.getItem(key)) {
                return true;
            }
            if (local && local.getItem(key)) {
                return true;
            }
        } catch (e) {}

        return false;
    }

    function markCustomerEmailSent(orderId) {
        if (!orderId) {
            return;
        }

        const key = "alora_customer_email_sent_" + orderId;
        const timestamp = new Date().toISOString();
        const session = getStorage("sessionStorage");
        const local = getStorage("localStorage");

        try {
            if (session) {
                session.setItem(key, timestamp);
            }
            if (local) {
                local.setItem(key, timestamp);
            }
        } catch (e) {}
    }

    /* ---- PAYLOAD BUILDERS ---- */

    function extractProductSummary(order) {
        if (order.products) {
            return String(order.products).trim();
        }
        if (Array.isArray(order.items) && order.items.length > 0) {
            return order.items.map(function (i) {
                return i.name || "Item";
            }).join(", ");
        }
        return "New Order";
    }

    function extractOrderQuantity(order) {
        if (order.quantity !== undefined && order.quantity !== null && String(order.quantity).trim() !== "") {
            return String(order.quantity).trim();
        }
        if (Array.isArray(order.items)) {
            const sum = order.items.reduce(function (tot, i) {
                return tot + (Number(i.quantity) || 0);
            }, 0);
            if (sum > 0) {
                return String(sum);
            }
        }
        return "1";
    }

    const ALORA_PRODUCTION_URL = "https://alora-handmade-jewelry.web.app";

    function ensureProductionAdminUrl(adminUrl, orderId, userId) {
        const id = String(orderId || "").trim();
        const uid = String(userId || "").trim();
        const fallback = `${ALORA_PRODUCTION_URL}/admin.html?orderId=${encodeURIComponent(id)}&userId=${encodeURIComponent(uid)}`;

        if (!adminUrl || typeof adminUrl !== "string") {
            return fallback;
        }

        const trimmed = adminUrl.trim();
        if (trimmed.includes("127.0.0.1") || trimmed.includes("localhost")) {
            try {
                const parsed = new URL(trimmed);
                const prodUrl = new URL("admin.html", ALORA_PRODUCTION_URL);
                prodUrl.search = parsed.search;
                return prodUrl.toString();
            } catch (_) {
                return fallback;
            }
        }

        return trimmed;
    }

    function buildOrderEmailPayload(order, orderId, adminUrl) {
        const id = String(orderId || order.id || "").trim();
        const userId = String(order.userId || order.user_id || order.customerUid || "").trim();
        const productName = extractProductSummary(order);
        const quantity = extractOrderQuantity(order);
        const cleanAdminUrl = ensureProductionAdminUrl(adminUrl, id, userId);

        return {
            order_id: id,
            subject: "New Alora Order - " + (productName || id),
            customer_name: String(order.customer || "Customer unavailable").trim(),
            customer_phone: String(order.phone || "Not provided").trim(),
            customer_email: String(order.email || "Not provided").trim(),
            delivery_address: String(order.address || "Not provided").trim(),
            products: productName,
            quantity: quantity,
            total: String(order.total || "₹0").trim(),
            payment_method: String(order.payment || "Not specified").trim(),
            utr: String(order.utr || "N/A").trim(),
            order_date: String(order.date || new Date().toLocaleString("en-IN")).trim(),
            admin_order_url: cleanAdminUrl
        };
    }

    function buildCustomerEmailPayload(order, orderId) {
        const config = getEmailConfig();
        const id = String(orderId || order.id || "").trim();
        const productName = extractProductSummary(order);
        const quantity = extractOrderQuantity(order);
        const customerEmail = String(order.email || "").trim();
        const customerName = String(order.customer || "Valued Customer").trim();

        return {
            to_email: customerEmail,
            recipient_email: customerEmail,
            customer_name: customerName,
            order_id: id,
            subject: "Your Alora Order Has Been Placed - " + id,
            order_date: String(order.date || new Date().toLocaleString("en-IN")).trim(),
            products: productName,
            quantity: quantity,
            total: String(order.total || "₹0").trim(),
            payment_method: String(order.payment || "Not specified").trim(),
            utr: String(order.utr || "N/A").trim(),
            delivery_address: String(order.address || "Not provided").trim(),
            support_note: "We have received your order successfully. We will contact you if any additional information is needed. For any questions, contact Alora support.",
            support_email: config.supportEmail,
            support_phone: config.supportPhone,
            brand_name: config.brandName,
            thank_you_message: "Thank you for ordering from " + config.brandName + "!"
        };
    }

    /* ---- DISPATCHERS ---- */

    async function sendAdminOrderNotificationEmail(order, adminUrl, options) {
        const opts = options || {};
        const fetchFn = opts.fetchImpl ||
            (typeof window !== "undefined" && window.fetch ? window.fetch.bind(window) : null) ||
            (typeof fetch !== "undefined" ? fetch : null);
        const config = getEmailConfig();

        if (!order) {
            console.warn("sendAdminOrderNotificationEmail: order object is missing.");
            return { skipped: true, reason: "missing_order" };
        }

        const orderId = order.id || order.orderId;
        if (!orderId) {
            console.warn("sendAdminOrderNotificationEmail: order ID is missing.");
            return { skipped: true, reason: "missing_order_id" };
        }

        if (isOrderEmailAlreadySent(orderId)) {
            console.log("Admin email notification already sent for order:", orderId);
            return { skipped: true, reason: "already_sent", orderId: orderId };
        }

        const isConfigured = config.publicKey &&
            config.publicKey !== "your_emailjs_public_key" &&
            config.serviceId &&
            config.adminTemplateId;

        const payload = buildOrderEmailPayload(order, orderId, adminUrl);

        if (!isConfigured) {
            console.info(
                "Admin order email notification skipped: EmailJS configuration has placeholder values.",
                "To enable automatic emails, set window.ALORA_EMAIL_CONFIG with your EmailJS serviceId, adminTemplateId (or templateId), and publicKey.",
                payload
            );
            return { skipped: true, reason: "unconfigured", payload: payload };
        }

        try {
            const requestBody = {
                service_id: config.serviceId,
                template_id: config.adminTemplateId,
                user_id: config.publicKey,
                template_params: payload
            };

            const response = await fetchFn(config.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errText = await response.text().catch(function () { return ""; });
                throw new Error("EmailJS API responded with HTTP " + response.status + ": " + errText);
            }

            markOrderEmailSent(orderId);
            console.log("✓ Admin order notification email sent successfully for order:", orderId);
            return { success: true, orderId: orderId };

        } catch (error) {
            // Log safely for debugging - MUST NEVER reject or crash customer checkout
            console.error("Admin order email notification failed for order " + orderId + ":", error.message);
            return { success: false, error: error.message, orderId: orderId };
        }
    }

    async function sendCustomerOrderConfirmationEmail(order, options) {
        const opts = options || {};
        const fetchFn = opts.fetchImpl ||
            (typeof window !== "undefined" && window.fetch ? window.fetch.bind(window) : null) ||
            (typeof fetch !== "undefined" ? fetch : null);
        const config = getEmailConfig();

        if (!order) {
            console.warn("sendCustomerOrderConfirmationEmail: order object is missing.");
            return { skipped: true, reason: "missing_order" };
        }

        const orderId = order.id || order.orderId;
        if (!orderId) {
            console.warn("sendCustomerOrderConfirmationEmail: order ID is missing.");
            return { skipped: true, reason: "missing_order_id" };
        }

        if (!isValidCustomerEmail(order.email)) {
            console.warn(
                "Customer confirmation email skipped: Invalid or missing email address (" +
                String(order.email) +
                ") for order " +
                orderId
            );
            return {
                skipped: true,
                reason: "invalid_customer_email",
                orderId: orderId,
                email: order.email
            };
        }

        if (isCustomerEmailAlreadySent(orderId)) {
            console.log("Customer confirmation email already sent for order:", orderId);
            return { skipped: true, reason: "already_sent", orderId: orderId };
        }

        const isConfigured = config.publicKey &&
            config.publicKey !== "your_emailjs_public_key" &&
            config.serviceId &&
            config.customerTemplateId;

        const payload = buildCustomerEmailPayload(order, orderId);

        if (!isConfigured) {
            console.info(
                "Customer confirmation email skipped: EmailJS configuration has placeholder values.",
                "To enable automatic customer emails, set window.ALORA_EMAIL_CONFIG with your EmailJS customerTemplateId.",
                payload
            );
            return { skipped: true, reason: "unconfigured", payload: payload };
        }

        try {
            const requestBody = {
                service_id: config.serviceId,
                template_id: config.customerTemplateId,
                user_id: config.publicKey,
                template_params: payload
            };

            const response = await fetchFn(config.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errText = await response.text().catch(function () { return ""; });
                throw new Error("EmailJS API responded with HTTP " + response.status + ": " + errText);
            }

            markCustomerEmailSent(orderId);
            console.log("✓ Customer order confirmation email sent successfully for order:", orderId, "to", order.email);
            return { success: true, orderId: orderId, recipient: order.email };

        } catch (error) {
            // Log safely for debugging - MUST NEVER reject or crash customer checkout
            console.error("Customer confirmation email failed for order " + orderId + ":", error.message);
            return { success: false, error: error.message, orderId: orderId };
        }
    }

    /**
     * Sends both Admin Notification and Customer Confirmation emails.
     * Uses Promise.allSettled so that an error in one email never prevents
     * or cancels the other email.
     */
    async function sendOrderEmails(order, adminUrl, options) {
        if (!order) {
            console.warn("sendOrderEmails: order object is missing.");
            return {
                admin: { skipped: true, reason: "missing_order" },
                customer: { skipped: true, reason: "missing_order" }
            };
        }

        const [adminResult, customerResult] = await Promise.allSettled([
            sendAdminOrderNotificationEmail(order, adminUrl, options),
            sendCustomerOrderConfirmationEmail(order, options)
        ]);

        return {
            admin: adminResult.status === "fulfilled"
                ? adminResult.value
                : { success: false, error: adminResult.reason && adminResult.reason.message },
            customer: customerResult.status === "fulfilled"
                ? customerResult.value
                : { success: false, error: customerResult.reason && customerResult.reason.message }
        };
    }

    // Export to global scope
    window.sendOrderEmails = sendOrderEmails;
    window.sendAdminOrderNotificationEmail = sendAdminOrderNotificationEmail;
    window.sendCustomerOrderConfirmationEmail = sendCustomerOrderConfirmationEmail;
    window.buildOrderEmailPayload = buildOrderEmailPayload;
    window.buildCustomerEmailPayload = buildCustomerEmailPayload;
    window.isValidCustomerEmail = isValidCustomerEmail;
    window.isOrderEmailAlreadySent = isOrderEmailAlreadySent;
    window.markOrderEmailSent = markOrderEmailSent;
    window.isCustomerEmailAlreadySent = isCustomerEmailAlreadySent;
    window.markCustomerEmailSent = markCustomerEmailSent;
    window.ALORA_PRODUCTION_URL = ALORA_PRODUCTION_URL;
    window.ensureProductionAdminUrl = ensureProductionAdminUrl;

})(typeof window !== "undefined" ? window : globalThis);
