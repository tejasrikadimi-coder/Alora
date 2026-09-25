/* =====================================================
   ALORA FIREBASE MY ORDERS
===================================================== */

import {
    auth,
    db
} from "./firebase.js";


import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const ordersList =
    document.getElementById("ordersList");

const emptyOrders =
    document.getElementById("emptyOrders");


let currentUserId = null;
const requestSubmissionsInFlight = new Set();


/* =====================================================
   CHECK LOGIN
===================================================== */

onAuthStateChanged(
    auth,
    async function (user) {
        if (!user) {
            sessionStorage.setItem(
                "aloraReturnUrl",
                window.location.href
            );

            window.location.href =
                "login.html";

            return;
        }

        currentUserId = user.uid;

        await loadFirebaseOrders(user.uid);
    }
);


/* =====================================================
   LOAD FIREBASE ORDERS
===================================================== */

async function loadFirebaseOrders(userId) {
    if (!ordersList) {
        return;
    }

    ordersList.innerHTML = `
        <div class="orders-loading">
            Loading your orders...
        </div>
    `;


    try {
        const ordersReference =
            collection(
                db,
                "users",
                userId,
                "orders"
            );


        const ordersQuery =
            query(
                ordersReference,
                orderBy("createdAt", "desc")
            );


        const ordersSnapshot =
            await getDocs(ordersQuery);


        ordersList.innerHTML = "";


        if (ordersSnapshot.empty) {
            if (emptyOrders) {
                emptyOrders.style.display =
                    "block";
            }

            return;
        }


        if (emptyOrders) {
            emptyOrders.style.display =
                "none";
        }


        ordersSnapshot.forEach(
            orderDocument => {
                const order =
                    orderDocument.data();

                createOrderCard(
                    orderDocument.id,
                    order
                );
            }
        );

    } catch (error) {
        ordersList.innerHTML = `
            <div class="orders-error">
                Unable to load orders. Please refresh and try again.
            </div>
        `;

        console.error(
            "Orders loading failed:",
            error
        );
    }
}


/* =====================================================
   CREATE ORDER CARD
===================================================== */

function createOrderCard(orderId, order) {
    window.activeOrdersMap = window.activeOrdersMap || {};
    window.activeOrdersMap[orderId] = order;

    const card =
        document.createElement("article");

    card.className =
        "order-history-card";


    const deliveryStart =
        formatDeliveryDate(
            order.estimatedDeliveryStart
        );


    const deliveryEnd =
        formatDeliveryDate(
            order.estimatedDeliveryEnd
        );


    const status =
        String(
            order.status ||
            "Order Received"
        ).trim();


    card.innerHTML = `
        <div class="order-history-header">

            <div>

                <h3>
                    Order #${escapeHTML(
                        order.id || orderId
                    )}
                </h3>

                <p class="order-history-date">
                    Placed on ${escapeHTML(
                        order.date || ""
                    )}
                </p>

            </div>


            <span class="order-status">
                ${escapeHTML(status)}
            </span>

        </div>


        <div class="delivery-estimate">

            <span class="delivery-icon">
                🚚
            </span>


            <div>

                <small>
                    ESTIMATED DELIVERY
                </small>

                <strong>
                    ${deliveryStart}
                    –
                    ${deliveryEnd}
                </strong>

            </div>

        </div>


        ${createTrackingTimeline(status)}


        <div class="order-history-body">

            <div class="order-history-info">

                <span>PRODUCTS</span>

                <strong>
                    ${escapeHTML(
                        order.products || ""
                    )}
                </strong>

            </div>


            <div class="order-history-info">

                <span>QUANTITY</span>

                <strong>
                    ${Number(order.quantity) || 1}
                </strong>

            </div>


            <div class="order-history-info">

                <span>PAYMENT</span>

                <strong>
                    ${escapeHTML(
                        order.payment || ""
                    )}
                </strong>

            </div>


            <div class="order-history-info">

                <span>PAYMENT STATUS</span>

                <strong>
                    ${escapeHTML(
                        order.paymentStatus ||
                        "Pending"
                    )}
                </strong>

            </div>

        </div>


        <div class="order-history-footer">

            <span>Order Total</span>

            <strong class="order-history-total">
                ${escapeHTML(
                    order.total || "₹0"
                )}
            </strong>

        </div>


        <div
            class="order-request-actions"
            id="orderActions-${orderId}">

            <span class="actions-loading">
                Loading available actions...
            </span>

        </div>
    `;


    ordersList.appendChild(card);


    loadOrderActions(
        orderId,
        order
    );
}


/* =====================================================
   TRACKING TIMELINE
===================================================== */

function createTrackingTimeline(status) {
    const trackingSteps = [
        "Order Received",
        "Confirmed",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered"
    ];


    const normalizedStatus =
        normalizeStatus(status);


    /* CANCELLED */

    if (normalizedStatus === "cancelled") {
        return `
            <div class="tracking-cancelled">
                Order Cancelled
            </div>
        `;
    }


    let currentIndex =
        trackingSteps.findIndex(
            step =>
                normalizeStatus(step) ===
                normalizedStatus
        );


    if (currentIndex === -1) {
        currentIndex = 0;
    }


    const stepsHTML =
        trackingSteps
            .map(
                (step, index) => {
                    const active =
                        index <= currentIndex;


                    return `
                        <div class="tracking-step ${
                            active ? "active" : ""
                        }">

                            <span class="tracking-dot">
                                ${
                                    active
                                        ? "✓"
                                        : ""
                                }
                            </span>

                            <small>
                                ${step}
                            </small>

                        </div>
                    `;
                }
            )
            .join("");


    return `
        <div class="order-tracking">
            ${stepsHTML}
        </div>
    `;
}


/* =====================================================
   LOAD CANCEL / RETURN / EXCHANGE REQUESTS
===================================================== */

async function loadOrderActions(
    orderId,
    order
) {
    const actionsContainer =
        document.getElementById(
            "orderActions-" + orderId
        );


    if (!actionsContainer) {
        return;
    }


    try {
        const requestsReference =
            collection(
                db,
                "users",
                currentUserId,
                "orders",
                orderId,
                "requests"
            );


        const requestsSnapshot =
            await getDocs(
                requestsReference
            );


        const requests = {};


        requestsSnapshot.forEach(
            requestDocument => {
                requests[requestDocument.id] =
                    requestDocument.data();
            }
        );


        renderOrderActions(
            actionsContainer,
            orderId,
            order,
            requests
        );

    } catch (error) {
        actionsContainer.innerHTML = `
            <span class="no-order-action">
                Actions unavailable
            </span>
        `;

        console.error(
            "Order actions failed:",
            error
        );
    }
}


/* =====================================================
   RENDER AVAILABLE ACTIONS
===================================================== */

function renderOrderActions(
    container,
    orderId,
    order,
    requests
) {
    const status =
        String(
            order.status ||
            "Order Received"
        ).trim();


    const normalizedStatus =
        normalizeStatus(status);


    /* CANCELLED */

    if (normalizedStatus === "cancelled") {
        container.innerHTML = `
            <span class="request-result cancelled">
                Order Cancelled
            </span>
        `;

        return;
    }


    /* CANCEL AVAILABLE */

    if (
        normalizedStatus === "orderreceived" ||
        normalizedStatus === "confirmed"
    ) {

        /* CANCEL REQUEST ALREADY SENT */

        if (requests.cancel) {
            container.innerHTML = `
                <span class="request-result pending">
                    Cancellation ${escapeHTML(
                        requests.cancel.status ||
                        "Requested"
                    )}
                </span>
            `;

            return;
        }


        /* SHOW CANCEL BUTTON */

        container.innerHTML = `
            <button
                type="button"
                class="cancel-order-button"
                onclick="openOrderRequest(
                    '${orderId}',
                    'cancel'
                )">
                Cancel Order
            </button>
        `;

        return;
    }


    /* DELIVERED */

    if (normalizedStatus === "delivered") {
        let returnActionsHtml = "";

        /* RETURN PERIOD ENDED */
        if (!isWithinReturnPeriod(order)) {
            returnActionsHtml = `
                <span class="return-period-ended">
                    Return and exchange period ended
                </span>
            `;
        } else if (requests.return) {
            returnActionsHtml = `
                <span class="request-result pending">
                    Return ${escapeHTML(
                        requests.return.status ||
                        "Requested"
                    )}
                </span>
            `;
        } else if (requests.exchange) {
            returnActionsHtml = `
                <span class="request-result pending">
                    Exchange ${escapeHTML(
                        requests.exchange.status ||
                        "Requested"
                    )}
                </span>
            `;
        } else {
            returnActionsHtml = `
                <button
                    type="button"
                    class="return-order-button"
                    onclick="openOrderRequest(
                        '${orderId}',
                        'return'
                    )">
                    Return Item
                </button>

                <button
                    type="button"
                    class="exchange-order-button"
                    onclick="openOrderRequest(
                        '${orderId}',
                        'exchange'
                    )">
                    Exchange Item
                </button>
            `;
        }

        container.innerHTML = `
            ${returnActionsHtml}
            <button
                type="button"
                class="rate-product-btn"
                id="reviewBtn-${orderId}"
                onclick="openReviewModal('${orderId}')">
                ⭐ Rate &amp; Review
            </button>
        `;

        const safeKey = (order.productId || (order.products || "item")).replace(/[^a-zA-Z0-9]/g, '_');
        const reviewDocRef = doc(db, "reviews", `${orderId}_${safeKey}`);
        getDoc(reviewDocRef).then(snap => {
            const btn = document.getElementById(`reviewBtn-${orderId}`);
            if (btn && snap && typeof snap.exists === "function" && snap.exists()) {
                const data = snap.data();
                btn.textContent = `✓ Reviewed (★ ${data.rating || 5})`;
                btn.disabled = true;
                btn.style.opacity = "0.7";
                btn.style.cursor = "default";
            }
        }).catch(() => {});

        return;
    }


    /* PROCESSING / SHIPPED */

    container.innerHTML = `
        <span class="no-order-action">
            Order is currently ${escapeHTML(status)}
        </span>
    `;
}


/* =====================================================
   RETURN / EXCHANGE PERIOD
   AVAILABLE FOR 7 DAYS AFTER DELIVERY
===================================================== */

function isWithinReturnPeriod(order) {
    if (!order.deliveredAt) {
        return true;
    }


    const deliveredDate =
        new Date(order.deliveredAt);


    if (
        Number.isNaN(
            deliveredDate.getTime()
        )
    ) {
        return true;
    }


    const returnEndDate =
        new Date(deliveredDate);


    returnEndDate.setDate(
        returnEndDate.getDate() + 7
    );


    return new Date() <= returnEndDate;
}


/* =====================================================
   OPEN REQUEST MODAL
===================================================== */
async function cancelOrderNow(orderId) {
    window.openOrderRequest(
        orderId,
        "cancel"
    );

    return;

    /*
    try {
        const orderReference =
            doc(
                db,
                "users",
                currentUserId,
                "orders",
                orderId
            );

        const orderSnapshot =
            await getDoc(orderReference);

        if (!orderSnapshot.exists()) {
            throw new Error(
                "Order not found."
            );
        }

        const order =
            orderSnapshot.data();

        const orderItems =
            Array.isArray(order.items) &&
            order.items.length > 0
                ? order.items
                : [
                    {
                        name:
                            order.products,

                        quantity:
                            Number(
                                order.quantity
                            ) || 1
                    }
                ];

        const productEntries = [];

        for (const item of orderItems) {
            const productQuery =
                query(
                    collection(
                        db,
                        "products"
                    ),
                    where(
                        "name",
                        "==",
                        item.name
                    )
                );

            const productSnapshot =
                await getDocs(
                    productQuery
                );

            if (productSnapshot.empty) {
                throw new Error(
                    item.name +
                    " product not found."
                );
            }

            productEntries.push({
                reference:
                    productSnapshot
                        .docs[0]
                        .ref,

                quantity:
                    Number(
                        item.quantity
                    ) || 1
            });
        }

        await runTransaction(
            db,
            async function (transaction) {
                const latestOrderSnapshot =
                    await transaction.get(
                        orderReference
                    );

                if (
                    !latestOrderSnapshot.exists()
                ) {
                    throw new Error(
                        "Order not found."
                    );
                }

                const latestOrder =
                    latestOrderSnapshot.data();

                const status =
                    normalizeStatus(
                        latestOrder.status
                    );

                if (status === "cancelled") {
                    throw new Error(
                        "Order is already cancelled."
                    );
                }

                if (
                    status !== "orderreceived" &&
                    status !== "confirmed"
                ) {
                    throw new Error(
                        "This order can no longer be cancelled."
                    );
                }

                if (
                    latestOrder.stockRestored ===
                    true
                ) {
                    throw new Error(
                        "Stock was already restored."
                    );
                }

                const productSnapshots =
                    await Promise.all(
                        productEntries.map(
                            entry =>
                                transaction.get(
                                    entry.reference
                                )
                        )
                    );

                productSnapshots.forEach(
                    (
                        productSnapshot,
                        index
                    ) => {
                        const currentStock =
                            Number(
                                productSnapshot
                                    .data()
                                    .stock
                            ) || 0;

                        transaction.update(
                            productEntries[index]
                                .reference,
                            {
                                stock:
                                    currentStock +
                                    productEntries[index]
                                        .quantity
                            }
                        );
                    }
                );

                const cancelledAt =
                    new Date()
                        .toISOString();

                transaction.update(
                    orderReference,
                    {
                        status:
                            "Cancelled",

                        cancelRequest: {
                            status:
                                "Approved",

                            requestedAt:
                                cancelledAt
                        },

                        cancelledAt:
                            cancelledAt,

                        stockRestored:
                            true,

                        updatedAt:
                            cancelledAt
                    }
                );
            }
        );

        alert(
            "Order cancelled successfully."
        );

        await loadFirebaseOrders(
            currentUserId
        );

    } catch (error) {
        alert(
            error.message ||
            "Unable to cancel order."
        );

        console.error(
            "Order cancellation failed:",
            error
        );
    }
    */
}

window.openOrderRequest =
    function (orderId, type) {
       
 const existingModal =
            document.getElementById(
                "orderRequestModal"
            );


        if (existingModal) {
            existingModal.remove();
        }


        let title =
            "Cancel Order";


        if (type === "return") {
            title =
                "Return Item";
        }


        if (type === "exchange") {
            title =
                "Exchange Item";
        }


        const modal =
            document.createElement("div");


        modal.id =
            "orderRequestModal";


        modal.className =
            "order-request-modal";


        modal.innerHTML = `
            <div class="request-modal-card">

                <button
                    type="button"
                    class="request-modal-close"
                    onclick="closeOrderRequest()"
                    aria-label="Close request form">
                    ×
                </button>


                <p class="section-label">
                    ORDER REQUEST
                </p>


                <h2>
                    ${title}
                </h2>


                <p class="request-modal-description">
                    Please tell us the reason for this request.
                </p>


                <textarea
                    id="orderRequestReason"
                    placeholder="Enter your reason..."
                    maxlength="500"></textarea>


                <p
                    class="request-modal-message"
                    id="requestModalMessage">
                </p>


                <div class="request-modal-actions">

                    <button
                        type="button"
                        class="request-back-button"
                        onclick="closeOrderRequest()">
                        Back
                    </button>


                    <button
                        type="button"
                        class="request-submit-button"
                        onclick="submitOrderRequest(
                            '${orderId}',
                            '${type}'
                        )">
                        Submit Request
                    </button>

                </div>

            </div>
        `;


        document.body.appendChild(modal);
    };


/* =====================================================
   CLOSE REQUEST MODAL
===================================================== */

window.closeOrderRequest =
    function () {
        const modal =
            document.getElementById(
                "orderRequestModal"
            );


        if (modal) {
            modal.remove();
        }
    };

/* =====================================================
   SUBMIT REQUEST
===================================================== */

window.submitOrderRequest =
    async function (
        orderId,
        type
    ) {
        const reasonInput =
            document.getElementById(
                "orderRequestReason"
            );

        const message =
            document.getElementById(
                "requestModalMessage"
            );

        const submitButton =
            document.querySelector(
                ".request-submit-button"
            );


        if (
            !reasonInput ||
            !message ||
            !submitButton
        ) {
            return;
        }


        const reason =
            reasonInput.value.trim();


        if (reason === "") {
            message.textContent =
                "Please enter a reason.";

            return;
        }

        const requestKey =
            orderId + ":" + type;

        if (
            requestSubmissionsInFlight.has(
                requestKey
            )
        ) {
            return;
        }

        if (
            type === "cancel" &&
            !window.confirm(
                "Submit a cancellation request for this order?"
            )
        ) {
            return;
        }

        requestSubmissionsInFlight.add(
            requestKey
        );

        submitButton.disabled = true;

        submitButton.textContent =
            "Submitting...";


        try {
            const requestReference =
                doc(
                    db,
                    "users",
                    currentUserId,
                    "orders",
                    orderId,
                    "requests",
                    type
                );

            const existingRequest =
                await getDoc(
                    requestReference
                );

            if (existingRequest.exists()) {
                message.textContent =
                    type === "cancel"
                        ? "Cancellation " +
                            (
                                existingRequest
                                    .data()
                                    .status ||
                                "Requested"
                            )
                        : "Request " +
                            (
                                existingRequest
                                    .data()
                                    .status ||
                                "Requested"
                            );

                return;
            }

            if (type === "cancel") {
                const orderReference =
                    doc(
                        db,
                        "users",
                        currentUserId,
                        "orders",
                        orderId
                    );

                const orderSnapshot =
                    await getDoc(
                        orderReference
                    );

                if (!orderSnapshot.exists()) {
                    throw new Error(
                        "Order not found."
                    );
                }

                const status =
                    normalizeStatus(
                        orderSnapshot
                            .data()
                            .status
                    );

                if (
                    status !== "orderreceived" &&
                    status !== "confirmed"
                ) {
                    throw new Error(
                        "This order can no longer be cancelled."
                    );
                }
            }

            await setDoc(
                requestReference,
                {
                    type:
                        type,

                    reason:
                        reason,

                    status:
                        "Requested",

                    requestedAt:
                        new Date()
                            .toISOString()
                }
            );


            message.classList.add(
                "success"
            );

            message.textContent =
                type === "cancel"
                    ? "Cancellation Requested"
                    : "Request submitted successfully.";


            setTimeout(
                function () {
                    closeOrderRequest();

                    loadFirebaseOrders(
                        currentUserId
                    );
                },
                900
            );


        } catch (error) {
            submitButton.disabled = false;

            submitButton.textContent =
                "Submit Request";

            message.textContent =
                "Unable to submit request. Please try again.";

            console.error(
                "Request submission failed:",
                error
            );
        } finally {
            requestSubmissionsInFlight.delete(
                requestKey
            );
        }
    };
/* =====================================================
   NORMALIZE ORDER STATUS
===================================================== */

function normalizeStatus(status) {
    return String(status || "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}


/* =====================================================
   FORMAT DELIVERY DATE
===================================================== */

function formatDeliveryDate(dateValue) {
    if (!dateValue) {
        return "To be updated";
    }


    const date =
        new Date(dateValue);


    if (Number.isNaN(date.getTime())) {
        return "To be updated";
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =====================================================
   CUSTOMER REVIEW MODAL & SUBMISSION
===================================================== */

window.openReviewModal = async function(orderId) {
    const order = window.activeOrdersMap ? window.activeOrdersMap[orderId] : null;
    if (!order) return;

    let modal = document.getElementById("reviewModalBackdrop");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "reviewModalBackdrop";
        modal.className = "review-modal-backdrop";
        document.body.appendChild(modal);
    }

    const productName = order.products || (Array.isArray(order.items) && order.items[0] ? order.items[0].name : "Jewellery");
    const safeKey = (order.productId || productName).replace(/[^a-zA-Z0-9]/g, '_');

    modal.innerHTML = `
        <div class="review-modal">
            <h3>Rate &amp; Review Product</h3>
            <p style="font-size: 13.5px; color: var(--text); margin-bottom: 14px;">Product: <strong>${escapeHTML(productName)}</strong></p>
            <div class="interactive-stars" id="interactiveStars">
                <span class="star selected" data-value="1">★</span>
                <span class="star selected" data-value="2">★</span>
                <span class="star selected" data-value="3">★</span>
                <span class="star selected" data-value="4">★</span>
                <span class="star selected" data-value="5">★</span>
            </div>
            <textarea id="reviewModalText" placeholder="Share your experience with this jewelry (craftsmanship, finish, packaging, etc.)..."></textarea>
            <div class="review-modal-buttons">
                <button type="button" class="btn" style="background:#e0dedb; color:#222; padding: 8px 16px; border-radius:6px; font-size:13px;" onclick="closeReviewModal()">Cancel</button>
                <button type="button" class="rate-product-btn" id="confirmReviewBtn">Submit Review</button>
            </div>
        </div>
    `;

    modal.style.display = "flex";

    let selectedRating = 5;
    const starEls = modal.querySelectorAll(".interactive-stars .star");
    starEls.forEach(star => {
        star.addEventListener("click", () => {
            selectedRating = Number(star.dataset.value);
            starEls.forEach(s => {
                s.classList.toggle("selected", Number(s.dataset.value) <= selectedRating);
            });
        });
    });

    const confirmBtn = document.getElementById("confirmReviewBtn");
    confirmBtn.addEventListener("click", async () => {
        const text = document.getElementById("reviewModalText").value.trim();
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Submitting...";

        try {
            await setDoc(doc(db, "reviews", `${orderId}_${safeKey}`), {
                userId: currentUserId || "",
                customerName: order.name || order.customerName || "Verified Buyer",
                orderId: orderId,
                productId: order.productId || "",
                productName: productName,
                rating: selectedRating,
                reviewText: text,
                status: "approved",
                createdAt: new Date().toISOString()
            });

            closeReviewModal();
            const btn = document.getElementById(`reviewBtn-${orderId}`);
            if (btn) {
                btn.textContent = `✓ Reviewed (★ ${selectedRating})`;
                btn.disabled = true;
                btn.style.opacity = "0.7";
                btn.style.cursor = "default";
            }
            alert("Thank you! Your review has been submitted successfully.");
        } catch (err) {
            console.error("Review submission failed:", err);
            alert("Could not submit your review right now. Please try again.");
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Submit Review";
        }
    });
};

window.closeReviewModal = function() {
    const modal = document.getElementById("reviewModalBackdrop");
    if (modal) {
        modal.style.display = "none";
    }
};