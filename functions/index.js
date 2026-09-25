const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

const {
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");

const {
  defineSecret,
} = require("firebase-functions/params");

const {
  initializeApp,
} = require("firebase-admin/app");

const {
  getFirestore,
} = require("firebase-admin/firestore");

const {
  buildAdminOrderUrl,
  formatOrderNotification,
  isNotificationSent,
  sendWhatsAppText,
} = require("./whatsapp");

const {
  buildAdminOrderUrl: buildAdminOrderUrlForEmail,
  isEmailNotificationSent,
  isCustomerEmailNotificationSent,
  sendAdminOrderEmail,
  sendCustomerOrderEmail,
} = require("./email");


const whatsappAccessToken =
  defineSecret("WHATSAPP_ACCESS_TOKEN");
const whatsappPhoneNumberId =
  defineSecret("WHATSAPP_PHONE_NUMBER_ID");
const whatsappAdminNumber =
  defineSecret("WHATSAPP_ADMIN_NUMBER");
const aloraSiteUrl =
  defineSecret("ALORA_SITE_URL");
const resendApiKey =
  defineSecret("RESEND_API_KEY");
const adminEmail =
  defineSecret("ADMIN_EMAIL");


initializeApp();

const db = getFirestore();


exports.notifyAdminNewOrder = onDocumentCreated(
    {
      document: "users/{userId}/orders/{orderId}",
      region: "asia-south1",
      secrets: [
        whatsappAccessToken,
        whatsappPhoneNumberId,
        whatsappAdminNumber,
        aloraSiteUrl,
      ],
    },
    async (event) => {
      const userId = event.params.userId;
      const orderId = event.params.orderId;
      const order = event.data && event.data.data();

      if (!order) {
        console.error(
            "New order notification skipped because order data is missing:",
            orderId,
        );
        return;
      }

      const notificationId =
        `${userId}_${orderId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const notificationReference =
        db.collection("orderNotifications").doc(notificationId);
      const existingNotification =
        await notificationReference.get();

      if (existingNotification.exists &&
          isNotificationSent(existingNotification.data())) {
        console.log(
            "New order notification already sent:",
            orderId,
        );
        return;
      }

      const adminUrl =
        buildAdminOrderUrl(
            aloraSiteUrl.value(),
            orderId,
            userId,
        );
      const message =
        formatOrderNotification(
            order,
            orderId,
            adminUrl,
        );

      try {
        await sendWhatsAppText({
          fetchImpl: fetch,
          accessToken: whatsappAccessToken.value(),
          phoneNumberId: whatsappPhoneNumberId.value(),
          recipient: whatsappAdminNumber.value(),
          message,
        });
      } catch (error) {
        console.error(
            "New order WhatsApp notification failed:",
            orderId,
            error.message,
        );
        throw error;
      }

      await notificationReference.set({
        status: "sent",
        orderId,
        userId,
        sentAt: new Date().toISOString(),
      });
    },
);


exports.notifyAdminNewOrderEmail = onDocumentCreated(
    {
      document: "users/{userId}/orders/{orderId}",
      region: "asia-south1",
      secrets: [
        resendApiKey,
        adminEmail,
        aloraSiteUrl,
      ],
    },
    async (event) => {
      const userId = event.params.userId;
      const orderId = event.params.orderId;
      const order = event.data && event.data.data();

      if (!order) {
        console.error(
            "New order email skipped because order data is missing:",
            orderId,
        );
        return;
      }

      const notificationId =
        `${userId}_${orderId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const notificationReference =
        db.collection("orderNotifications").doc(notificationId);
      const existingNotification =
        await notificationReference.get();
      const existingData = existingNotification.exists ?
        existingNotification.data() :
        null;

      const adminAlreadySent = isEmailNotificationSent(existingData);
      const customerAlreadySent = isCustomerEmailNotificationSent(existingData);

      if (adminAlreadySent && customerAlreadySent) {
        console.log(
            "Both admin and customer emails already sent for order:",
            orderId,
        );
        return;
      }

      const adminUrl =
        buildAdminOrderUrlForEmail(
            aloraSiteUrl.value(),
            orderId,
            userId,
        );

      const updatePayload = {
        orderId,
        userId,
      };

      // 1. Admin Notification Email
      if (!adminAlreadySent) {
        try {
          await sendAdminOrderEmail({
            fetchImpl: fetch,
            apiKey: resendApiKey.value(),
            to: adminEmail.value(),
            order,
            orderId,
            adminUrl,
          });
          updatePayload.adminEmailSent = true;
          updatePayload.emailSent = true;
          updatePayload.adminEmailSentAt = new Date().toISOString();
          updatePayload.emailSentAt = new Date().toISOString();
          console.log("✓ Admin order email sent successfully:", orderId);
        } catch (error) {
          console.error(
              "Admin order email notification failed:",
              orderId,
              error.message,
          );
        }
      }

      // 2. Customer Confirmation Email
      const customerEmail = String(order.email || "").trim();
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);

      if (!customerAlreadySent) {
        if (isValidEmail) {
          try {
            await sendCustomerOrderEmail({
              fetchImpl: fetch,
              apiKey: resendApiKey.value(),
              to: customerEmail,
              order,
              orderId,
            });
            updatePayload.customerEmailSent = true;
            updatePayload.customerEmailSentAt = new Date().toISOString();
            console.log(
                "✓ Customer confirmation email sent successfully to",
                customerEmail,
                "for order:",
                orderId,
            );
          } catch (error) {
            console.error(
                "Customer confirmation email failed for order",
                orderId,
                ":",
                error.message,
            );
          }
        } else {
          console.warn(
              "Customer email skipped (invalid address):",
              customerEmail,
              "for order:",
              orderId,
          );
        }
      }

      if (Object.keys(updatePayload).length > 2) {
        await notificationReference.set(
            updatePayload,
            {merge: true},
        );
      }
    },
);


exports.cancelOrder = onCall(
    {
      region: "asia-south1",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "Please login to cancel the order.",
        );
      }


      const orderId =
        String(request.data.orderId || "").trim();


      if (!orderId) {
        throw new HttpsError(
            "invalid-argument",
            "Order ID is required.",
        );
      }


      const userId =
        request.auth.uid;


      const orderReference =
        db
            .collection("users")
            .doc(userId)
            .collection("orders")
            .doc(orderId);


      await db.runTransaction(
          async (transaction) => {
            const orderSnapshot =
              await transaction.get(
                  orderReference,
              );


            if (!orderSnapshot.exists) {
              throw new HttpsError(
                  "not-found",
                  "Order not found.",
              );
            }


            const order =
              orderSnapshot.data();


            const status =
              String(order.status || "")
                  .toLowerCase()
                  .replace(/[^a-z]/g, "");


            if (status === "cancelled") {
              throw new HttpsError(
                  "already-exists",
                  "Order is already cancelled.",
              );
            }


            if (
              status !== "orderreceived" &&
              status !== "confirmed"
            ) {
              throw new HttpsError(
                  "failed-precondition",
                  "This order cannot be cancelled now.",
              );
            }


            if (order.stockRestored === true) {
              throw new HttpsError(
                  "already-exists",
                  "Stock was already restored.",
              );
            }


            const items =
  Array.isArray(order.items) ?
    order.items :
    [];


            if (items.length === 0) {
              throw new HttpsError(
                  "failed-precondition",
                  "Order item details are missing.",
              );
            }


            const productEntries = [];


            for (const item of items) {
              const name =
                String(item.name || "").trim();

              const quantity =
                Number(item.quantity) || 1;


              if (!name || quantity < 1) {
                throw new HttpsError(
                    "invalid-argument",
                    "Invalid order item.",
                );
              }


              const productQuery =
                db
                    .collection("products")
                    .where(
                        "name",
                        "==",
                        name,
                    )
                    .limit(1);


              const productSnapshot =
                await transaction.get(
                    productQuery,
                );


              if (productSnapshot.empty) {
                throw new HttpsError(
                    "not-found",
                    name + " product not found.",
                );
              }


              productEntries.push({
                reference:
                  productSnapshot.docs[0].ref,

                snapshot:
                  productSnapshot.docs[0],

                quantity:
                  quantity,
              });
            }


            for (const entry of productEntries) {
              const currentStock =
                Number(
                    entry.snapshot
                        .data()
                        .stock,
                ) || 0;


              transaction.update(
                  entry.reference,
                  {
                    stock:
                      currentStock +
                      entry.quantity,
                  },
              );
            }


            const cancelledAt =
              new Date().toISOString();


            transaction.update(
                orderReference,
                {
                  status:
                    "Cancelled",

                  cancelRequest: {
                    status:
                      "Approved",

                    requestedAt:
                      cancelledAt,
                  },

                  stockRestored:
                    true,

                  cancelledAt:
                    cancelledAt,

                  updatedAt:
                    cancelledAt,
                },
            );
          },
      );


      return {
        success: true,
        message:
          "Order cancelled successfully.",
      };
    },
);
