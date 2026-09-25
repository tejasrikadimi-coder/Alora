/* =====================================================
   ALORA ADMIN DASHBOARD
===================================================== */

import {
    auth,
    db
} from "./firebase.js";


import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


import {
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    deleteDoc,
    updateDoc,
    addDoc,
    setDoc,
    serverTimestamp,
    runTransaction,
    where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =====================================================
   ELEMENTS
===================================================== */

const adminAccessMessage =
    document.getElementById(
        "adminAccessMessage"
    );

const adminDashboardContent =
    document.getElementById(
        "adminDashboardContent"
    );

const adminWelcome =
    document.getElementById(
        "adminWelcome"
    );

const adminOrdersList =
    document.getElementById(
        "adminOrdersList"
    );

const adminMessagesList =
    document.getElementById(
        "adminMessagesList"
    );

const adminDirectOrderMessage =
    document.getElementById(
        "adminDirectOrderMessage"
    );

const adminTotalOrders =
    document.getElementById(
        "adminTotalOrders"
    );

const adminNewOrders =
    document.getElementById(
        "adminNewOrders"
    );

const adminShippedOrders =
    document.getElementById(
        "adminShippedOrders"
    );

const adminRequestCount =
    document.getElementById(
        "adminRequestCount"
    );
    const adminLowStockCount =
    document.getElementById(
        "adminLowStockCount"
    );



    const adminTotalOrdersCard =
    document.getElementById(
        "adminTotalOrdersCard"
    );

const adminNewOrdersCard =
    document.getElementById(
        "adminNewOrdersCard"
    );

const adminShippedOrdersCard =
    document.getElementById(
        "adminShippedOrdersCard"
    );

const adminRequestsCard =
    document.getElementById(
        "adminRequestsCard"
    );

const adminOrderSearch =
    document.getElementById(
        "adminOrderSearch"
    );

const adminStatusFilter =
    document.getElementById(
        "adminStatusFilter"
    );

const refreshOrdersButton =
    document.getElementById(
        "refreshOrdersButton"
    );

const adminLogoutButton =
    document.getElementById(
        "adminLogoutButton"
    );


let allAdminOrders = [];

let activeDashboardFilter =
    "all";

const ordersByKey =
    new Map();

const requestReviewInFlight =
    new Set();


/* =====================================================
   CHECK ADMIN LOGIN
===================================================== */

const ALORA_ADMIN_EMAIL = "alorajewels26@gmail.com";

function extractNormalizedRole(data) {
    if (!data) return "";
    const raw = data.role !== undefined ? data.role : data.Role;
    if (typeof raw === "string") return raw.trim().toLowerCase();
    if (data.isAdmin === true || data.isAdmin === "true" || data.isAdmin === "admin") return "admin";
    if (data.admin === true || data.admin === "true") return "admin";
    if (raw === true) return "admin";
    if (Array.isArray(data.roles) && data.roles.some(r => typeof r === "string" && r.trim().toLowerCase() === "admin")) return "admin";
    if (data.roles && typeof data.roles === "object" && data.roles.admin === true) return "admin";
    if (typeof data.type === "string" && data.type.trim().toLowerCase() === "admin") return "admin";
    if (typeof data.accountType === "string" && data.accountType.trim().toLowerCase() === "admin") return "admin";
    return "";
}


onAuthStateChanged(
    auth,
    async function (user) {

        /* NOT LOGGED IN */

        if (!user) {
            if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("__ALORA_TEST_MOCK_ADMIN__") === "true") {
                console.log("[ALORA AUTH DEBUG] Mock admin session active for testing");
                if (adminWelcome) adminWelcome.textContent = "Hi Madhuri";
                if (adminAccessMessage) adminAccessMessage.style.display = "none";
                if (adminDashboardContent) adminDashboardContent.hidden = false;
                openDirectOrderFromUrl();
                return;
            }

            const currentFullUrl = window.location.href;
            sessionStorage.setItem(
                "aloraReturnUrl",
                currentFullUrl
            );

            const loginUrl = new URL("login.html", window.location.href);
            const currentParams = new URLSearchParams(window.location.search);
            const orderId = currentParams.get("orderId");
            const userId = currentParams.get("userId");

            if (orderId) {
                loginUrl.searchParams.set("orderId", orderId);
            }
            if (userId) {
                loginUrl.searchParams.set("userId", userId);
            }
            loginUrl.searchParams.set("returnUrl", currentFullUrl);

            window.location.href = loginUrl.toString();

            return;
        }


        try {
            const userEmail =
                (user.email || "").trim().toLowerCase();

            const isAuthorizedEmail =
                userEmail ===
                ALORA_ADMIN_EMAIL.toLowerCase();

            const adminReference =
                doc(
                    db,
                    "users",
                    user.uid
                );

            let adminSnapshot =
                await getDoc(
                    adminReference
                );

            let matchedDoc =
                (adminSnapshot && typeof adminSnapshot.exists === "function" && adminSnapshot.exists())
                    ? adminSnapshot
                    : null;

            if (!matchedDoc) {
                try {
                    const emailRef = doc(db, "users", userEmail);
                    const emailSnap = await getDoc(emailRef);
                    if (emailSnap && typeof emailSnap.exists === "function" && emailSnap.exists()) {
                        matchedDoc = emailSnap;
                    }
                } catch (_) {}

                if (!matchedDoc) {
                    try {
                        const adminUidRef = doc(db, "admins", user.uid);
                        const adminUidSnap = await getDoc(adminUidRef);
                        if (adminUidSnap && typeof adminUidSnap.exists === "function" && adminUidSnap.exists()) {
                            matchedDoc = adminUidSnap;
                        }
                    } catch (_) {}
                }

                if (!matchedDoc) {
                    try {
                        const adminEmailRef = doc(db, "admins", userEmail);
                        const adminEmailSnap = await getDoc(adminEmailRef);
                        if (adminEmailSnap && typeof adminEmailSnap.exists === "function" && adminEmailSnap.exists()) {
                            matchedDoc = adminEmailSnap;
                        }
                    } catch (_) {}
                }
            }

            const docExists =
                Boolean(matchedDoc && typeof matchedDoc.exists === "function" && matchedDoc.exists());

            const adminData =
                docExists
                    ? (matchedDoc.data() || {})
                    : {};

            const rawRole =
                adminData.role !== undefined
                    ? adminData.role
                    : adminData.Role;

            const normalizedRole =
                extractNormalizedRole(adminData);

            const isRoleAdmin =
                docExists && normalizedRole === "admin";

            console.log(
                "[ALORA AUTH DEBUG]",
                {
                    currentPage: "admin.html",
                    file: "admin.js",
                    function: "onAuthStateChanged",
                    email: user.email,
                    uid: user.uid,
                    docExists,
                    firestoreRole:
                        rawRole !== undefined && rawRole !== null
                            ? rawRole
                            : "(undefined)",
                    normalizedRole,
                    chosenRedirectTarget:
                        isAuthorizedEmail &&
                        isRoleAdmin
                            ? "stay on admin.html"
                            : "index.html"
                }
            );

            /* NOT ADMIN */

            if (
                !isAuthorizedEmail ||
                !isRoleAdmin
            ) {
                adminAccessMessage.textContent =
                    "Access denied. Administrator account required.";

                adminAccessMessage.classList.add(
                    "error"
                );

                setTimeout(function () {
                    window.location.href =
                        "index.html";
                }, 1800);

                return;
            }



            /* ADMIN VERIFIED */

            adminWelcome.textContent =
                "Hi Madhuri";


            adminAccessMessage.style.display =
                "none";



            adminDashboardContent.hidden =
                false;


            await loadAllOrders();
            await loadAdminMessages();
            await loadAdminReviews();
            openDirectOrderFromUrl();

        } catch (error) {
            adminAccessMessage.textContent =
                "Unable to verify administrator access.";

            adminAccessMessage.classList.add(
                "error"
            );

            console.error(
                "Admin verification failed:",
                error
            );
        }

        async function loadAdminMessages() {
            if (!adminMessagesList) {
                return;
            }

            adminMessagesList.innerHTML =
                `<div class="admin-loading">Loading messages...</div>`;

            try {
                const messagesSnapshot =
                    await getDocs(
                        collection(
                            db,
                            "contactMessages"
                        )
                    );
                const messages =
                    messagesSnapshot.docs
                        .map(function (messageDocument) {
                            return {
                                id: messageDocument.id,
                                reference: messageDocument.ref,
                                data: messageDocument.data()
                            };
                        })
                        .sort(function (left, right) {
                            const leftTime =
                                left.data.createdAt &&
                                left.data.createdAt.toMillis
                                    ? left.data.createdAt.toMillis()
                                    : 0;
                            const rightTime =
                                right.data.createdAt &&
                                right.data.createdAt.toMillis
                                    ? right.data.createdAt.toMillis()
                                    : 0;
                            return rightTime - leftTime;
                        });

                renderAdminMessages(messages);
            } catch (error) {
                adminMessagesList.innerHTML =
                    `<div class="admin-error">Unable to load customer messages. Please try again.</div>`;
                console.error(
                    "Admin messages loading failed:",
                    error
                );
            }
        }

        function formatMessageTimestamp(timestamp) {
            if (
                timestamp &&
                typeof timestamp.toDate === "function"
            ) {
                return timestamp.toDate().toLocaleString(
                    "en-IN"
                );
            }

            return "Timestamp pending";
        }

        function renderAdminMessages(messages) {
            adminMessagesList.innerHTML = "";

            if (messages.length === 0) {
                adminMessagesList.innerHTML =
                    `<div class="admin-empty">No customer messages yet.</div>`;
                return;
            }

            messages.forEach(function (message) {
                const card =
                    document.createElement("article");
                const data = message.data;
                const header =
                    document.createElement("div");
                const sender =
                    document.createElement("strong");
                const email =
                    document.createElement("a");
                const subject =
                    document.createElement("h3");
                const body =
                    document.createElement("p");
                const metadata =
                    document.createElement("div");
                const status =
                    document.createElement("span");
                const timestamp =
                    document.createElement("span");

                card.className =
                    "admin-message-card";
                header.className =
                    "admin-message-header";
                sender.textContent =
                    data.name || "Unknown sender";
                email.textContent =
                    data.email || "No email";
                email.href =
                    data.email
                        ? "mailto:" + data.email
                        : "#";
                subject.textContent =
                    data.subject || "(No subject)";
                body.textContent =
                    data.message || "";
                metadata.className =
                    "admin-message-meta";
                status.className =
                    "admin-message-status " +
                    (
                        data.status === "Read"
                            ? "read"
                            : "new"
                    );
                status.textContent =
                    data.status || "New";
                timestamp.textContent =
                    formatMessageTimestamp(
                        data.createdAt
                    );

                header.appendChild(sender);
                header.appendChild(email);
                metadata.appendChild(status);
                metadata.appendChild(timestamp);

                card.appendChild(header);
                card.appendChild(subject);
                card.appendChild(body);
                card.appendChild(metadata);

                if (data.status === "New") {
                    const markRead =
                        document.createElement("button");
                    markRead.type = "button";
                    markRead.className =
                        "admin-message-read";
                    markRead.textContent =
                        "Mark as Read";
                    markRead.addEventListener(
                        "click",
                        function () {
                            markAdminMessageRead(
                                message.reference,
                                markRead,
                                status
                            );
                        }
                    );
                    card.appendChild(markRead);
                }

                adminMessagesList.appendChild(card);
            });
        }

        async function markAdminMessageRead(
            messageReference,
            button,
            statusElement
        ) {
            button.disabled = true;
            button.textContent = "Saving...";

            try {
                await updateDoc(
                    messageReference,
                    {
                        status: "Read"
                    }
                );
                statusElement.textContent = "Read";
                statusElement.classList.remove("new");
                statusElement.classList.add("read");
                button.remove();
            } catch (error) {
                button.disabled = false;
                button.textContent = "Mark as Read";
                console.error(
                    "Admin message update failed:",
                    error
                );
                alert(
                    "Unable to mark this message as read. Please try again."
                );
            }
        }
    }
);


/* =====================================================
   LOAD ALL CUSTOMER ORDERS
===================================================== */

async function loadAllOrders() {
    setRefreshLoading(true);


    adminOrdersList.innerHTML = `
        <div class="admin-orders-loading">
            Loading customer orders...
        </div>
    `;


    try {
        const ordersReference =
            collectionGroup(
                db,
                "orders"
            );


        const ordersQuery =
    query(
        collectionGroup(
            db,
            "orders"
        )
    );


        const ordersSnapshot =
            await getDocs(
                ordersQuery
            );


        const orderPromises =
            ordersSnapshot.docs.map(
                async orderDocument => {
                    const order =
                        orderDocument.data();


                    const userId =
                        order.userId ||
                        orderDocument
                            .ref
                            .parent
                            .parent
                            .id;


                    const orderKey =
                        userId +
                        "__" +
                        orderDocument.id;


                    const requests =
                        await loadOrderRequests(
                            orderDocument.ref
                        );


                    return {
                        key: orderKey,

                        id:
                            orderDocument.id,

                        userId: userId,

                        reference:
                            orderDocument.ref,

                        data: order,

                        requests: requests
                    };
                }

            );


        allAdminOrders =
            await Promise.all(
                orderPromises
            );


        ordersByKey.clear();


        allAdminOrders.forEach(
            order => {
                ordersByKey.set(
                    order.key,
                    order
                );
            }
        );


        updateStatistics();

        applyOrderFilters();

    } catch (error) {
        adminOrdersList.innerHTML = `
            <div class="admin-orders-error">
                Unable to load customer orders.
                Please check Firestore rules and try again.
            </div>
        `;


        console.error(
            "Admin orders loading failed:",
            error
        );

    } finally {
        setRefreshLoading(false);
    }
}


function getAdminOrderCardId(orderKey) {
    return "admin-order-" +
        encodeURIComponent(orderKey);
}

function showDirectOrderMessage(message) {
    if (!adminDirectOrderMessage) {
        return;
    }

    adminDirectOrderMessage.textContent =
        message;
    adminDirectOrderMessage.className =
        "admin-direct-order-message error";
    if (adminDirectOrderMessage.style) {
        adminDirectOrderMessage.style.display = "block";
    }

    if (typeof adminDirectOrderMessage.scrollIntoView === "function") {
        adminDirectOrderMessage.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}

function openDirectOrderFromUrl() {
    const params =
        new URLSearchParams(
            window.location.search
        );
    const orderId =
        params.get("orderId");
    const userId =
        params.get("userId");

    if (!orderId && !userId) {
        return;
    }

    const activeOrdersMap =
        (typeof window !== "undefined" && window.ordersByKey) ? window.ordersByKey : ordersByKey;
    const activeOrdersList =
        (typeof window !== "undefined" && Array.isArray(window.allAdminOrders) && window.allAdminOrders.length > 0)
            ? window.allAdminOrders
            : allAdminOrders;

    let order = null;

    if (userId && orderId) {
        const orderKey =
            userId + "__" + orderId;
        order =
            activeOrdersMap.get(orderKey);
    }

    if (!order && orderId && Array.isArray(activeOrdersList)) {
        order = activeOrdersList.find(function (o) {
            return (
                o.id === orderId ||
                o.key === orderId ||
                (o.data && (o.data.orderId === orderId || o.data.id === orderId))
            );
        });
    }

    if (!order) {
        showDirectOrderMessage(
            "Order not found or you do not have access to it."
        );
        return;
    }

    renderAdminOrders(activeOrdersList);

    const orderCard =
        document.getElementById(
            getAdminOrderCardId(order.key)
        );

    if (!orderCard) {
        showDirectOrderMessage(
            "Order not found or you do not have access to it."
        );
        return;
    }

    if (adminDirectOrderMessage) {
        if (adminDirectOrderMessage.style) {
            adminDirectOrderMessage.style.display = "none";
        }
        adminDirectOrderMessage.textContent = "";
    }

    orderCard.classList.add(
        "admin-order-card-highlight"
    );

    if (typeof orderCard.setAttribute === "function") {
        orderCard.setAttribute("tabindex", "-1");
    }
    if (typeof orderCard.focus === "function") {
        orderCard.focus({ preventScroll: true });
    }

    if (typeof orderCard.scrollIntoView === "function") {
        orderCard.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    setTimeout(function () {
        if (typeof orderCard.scrollIntoView === "function") {
            orderCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }, 150);

    setTimeout(function () {
        orderCard.classList.remove(
            "admin-order-card-highlight"
        );
    }, 6000);
}
window.openDirectOrderFromUrl = openDirectOrderFromUrl;


/* =====================================================
   LOAD REQUESTS FOR ONE ORDER
===================================================== */

async function loadOrderRequests(
    orderReference
) {
    const requestsReference =
        collection(
            orderReference,
            "requests"
        );


    const requestsSnapshot =
        await getDocs(
            requestsReference
        );


    const requests = {};


    requestsSnapshot.forEach(
        requestDocument => {
            requests[requestDocument.id] = {
                id:
                    requestDocument.id,

                reference:
                    requestDocument.ref,

                ...requestDocument.data()
            };
        }
    );


    return requests;
}


/* =====================================================
   STATISTICS
===================================================== */

function updateStatistics() {
    const total =
        allAdminOrders.length;


    const newOrders =
        allAdminOrders.filter(
            order =>
                normalizeStatus(
                    order.data.status
                ) === "orderreceived"
        ).length;


    const shippedOrders =
        allAdminOrders.filter(
            order => {
                const status =
                    normalizeStatus(
                        order.data.status
                    );

                return (
                    status === "shipped" ||
                    status ===
                        "outfordelivery"
                );
            }
        ).length;


    const requestCount =
        allAdminOrders.reduce(
            (totalRequests, order) => {
                const requested =
                    Object
                        .values(
                            order.requests
                        )
                        .filter(
                            request =>
                                normalizeStatus(
                                    request.status
                                ) ===
                                "requested"
                        )
                        .length;


                return (
                    totalRequests +
                    requested
                );
            },
            0
        );

    const deliveredOrders =
        allAdminOrders.filter(
            order =>
                normalizeStatus(
                    order.data.status
                ) === "delivered"
        ).length;

    adminTotalOrders.textContent =
        total;

    adminNewOrders.textContent =
        newOrders;

    adminShippedOrders.textContent =
        shippedOrders;

    const adminDeliveredOrdersEl =
        document.getElementById("adminDeliveredOrders");
    if (adminDeliveredOrdersEl) {
        adminDeliveredOrdersEl.textContent =
            deliveredOrders;
    }

    adminRequestCount.textContent =
        requestCount;
}


/* =====================================================
   FILTER ORDERS
===================================================== */

function applyOrderFilters() {
    const searchValue =
        adminOrderSearch
            .value
            .toLowerCase()
            .trim();


    const selectedStatus =
        adminStatusFilter.value;


    const filteredOrders =
        allAdminOrders.filter(
            order => {
                const data =
                    order.data;


                const searchableText = [
                    data.id,
                    order.id,
                    data.customer,
                    data.phone,
                    data.email,
                    data.products
                ]
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    searchableText.includes(
                        searchValue
                    );


                const matchesStatus =
                    selectedStatus === "all" ||
                    normalizeStatus(
                        data.status
                    ) ===
                    normalizeStatus(
                        selectedStatus
                    );
                    const normalizedStatus =
    normalizeStatus(
        data.status
    );

const hasPendingRequest =
    Object.values(
        order.requests || {}
    ).some(
        request =>
            normalizeStatus(
                request.status
            ) === "requested"
    );

let matchesDashboard = true;

if (
    activeDashboardFilter === "new"
) {
    matchesDashboard =
        normalizedStatus ===
        "orderreceived";
}

if (
    activeDashboardFilter === "shipped"
) {
    matchesDashboard =
        normalizedStatus === "shipped" ||
        normalizedStatus ===
            "outfordelivery";
}

if (
    activeDashboardFilter === "requests"
) {
    matchesDashboard =
        hasPendingRequest;
}

                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesDashboard
                );
            }
        );


    renderAdminOrders(
        filteredOrders
    );
}


/* =====================================================
   RENDER ADMIN ORDERS
===================================================== */

function renderAdminOrders(orders) {
    adminOrdersList.innerHTML = "";


    if (orders.length === 0) {
        adminOrdersList.innerHTML = `
            <div class="admin-orders-empty">
                No matching orders found.
            </div>
        `;

        return;
    }


    orders.forEach(
        order => {
            createAdminOrderCard(
                order
            );
        }
    );
}
window.renderAdminOrders = renderAdminOrders;


/* =====================================================
   CREATE ADMIN ORDER CARD
===================================================== */

function createAdminOrderCard(order) {
    const data =
        order.data;


    const currentStatus =
        String(
            data.status ||
            "Order Received"
        ).trim();


    const paymentStatus =
        String(
            data.paymentStatus ||
            "Pending"
        ).trim();


    const card =
        document.createElement(
            "article"
        );


    card.className =
        "admin-order-card";
    card.id =
        getAdminOrderCardId(order.key);


    card.innerHTML = `
        <div class="admin-order-header">

            <div>

                <span class="admin-order-label">
                    ORDER
                </span>

                <h3>
                    #${escapeHTML(
                        data.id ||
                        order.id
                    )}
                </h3>

                <p>
                    ${escapeHTML(
                        data.date ||
                        formatDate(
                            data.createdAt
                        )
                    )}
                </p>

            </div>


            <span class="admin-order-status">
                ${escapeHTML(
                    currentStatus
                )}
            </span>

        </div>


        <div class="admin-order-grid">

            <div class="admin-order-information">

                <span>CUSTOMER</span>

                <strong>
                    ${escapeHTML(
                        data.customer || ""
                    )}
                </strong>

                <small>
                    ${escapeHTML(
                        data.phone || ""
                    )}
                </small>

                <small>
                    ${escapeHTML(
                        data.email || ""
                    )}
                </small>

            </div>


            <div class="admin-order-information">

                <span>PRODUCTS</span>

                <strong>
                    ${escapeHTML(
                        data.products || ""
                    )}
                </strong>

                <small>
                    Quantity:
                    ${Number(
                        data.quantity
                    ) || 1}
                </small>

            </div>


            <div class="admin-order-information">

                <span>DELIVERY ADDRESS</span>

                <strong>
                    ${escapeHTML(
                        data.address || ""
                    )}
                </strong>

            </div>


            <div class="admin-order-information">

                <span>PAYMENT</span>

                <strong>
                    ${escapeHTML(
                        data.payment || ""
                    )}
                </strong>

                <small>
                    ${escapeHTML(
                        paymentStatus
                    )}
                </small>

                ${
                    data.utr
                        ? `
                            <small>
                                UTR:
                                ${escapeHTML(data.utr)}
                            </small>
                        `
                        : ""
                }

            </div>

        </div>


        <div class="admin-order-total">

            <span>Total</span>

            <strong>
                ${escapeHTML(
                    data.total || "₹0"
                )}
            </strong>

        </div>


        ${createRequestsHTML(order)}


        <div class="admin-order-controls">

            <div>

                <label>
                    Tracking Status
                </label>

                <select
                    onchange="updateAdminOrderStatus(
                        '${order.key}',
                        this.value
                    )">

                    ${createStatusOptions(
                        currentStatus
                    )}

                </select>

            </div>


            <div>

                <label>
                    Payment Status
                </label>

                <select
                    onchange="updateAdminPaymentStatus(
                        '${order.key}',
                        this.value
                    )">

                    ${createPaymentOptions(
                        paymentStatus
                    )}

                </select>

            </div>

        </div>

    `;


    adminOrdersList.appendChild(
        card
    );
}


/* =====================================================
   STATUS OPTIONS
===================================================== */

function createStatusOptions(
    currentStatus
) {
    const statuses = [
        "Order Received",
        "Confirmed",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled"
    ];


    return statuses
        .map(
            status => `
                <option
                    value="${status}"
                    ${
                        normalizeStatus(
                            status
                        ) ===
                        normalizeStatus(
                            currentStatus
                        )
                            ? "selected"
                            : ""
                    }>
                    ${status}
                </option>
            `
        )
        .join("");
}


/* =====================================================
   PAYMENT OPTIONS
===================================================== */

function createPaymentOptions(
    currentStatus
) {
    const statuses = [
        "Pending",
        "Awaiting Payment",
        "Payment Verification Pending",
        "Paid",
        "Failed",
        "Refunded"
    ];


    return statuses
        .map(
            status => `
                <option
                    value="${status}"
                    ${
                        normalizeStatus(
                            status
                        ) ===
                        normalizeStatus(
                            currentStatus
                        )
                            ? "selected"
                            : ""
                    }>
                    ${status}
                </option>
            `
        )
        .join("");
}


/* =====================================================
   REQUESTS HTML
===================================================== */

function createRequestsHTML(order) {
    const requests =
        Object.values(
            (order && order.requests) || {}
        );


    if (requests.length === 0) {
        return "";
    }


    const requestsHTML =
        requests
            .map(
                request => {
                    const requestStatus =
                        request.status ||
                        "Requested";


                    const pending =
                        normalizeStatus(
                            requestStatus
                        ) === "requested";


                    return `
                        <div class="admin-request-card">

                            <div>

                                <span>
                                    ${escapeHTML(
                                        request.type
                                    ).toUpperCase()}
                                    REQUEST
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        request.reason ||
                                        ""
                                    )}
                                </strong>

                                <small>
                                    Status:
                                    ${escapeHTML(
                                        requestStatus
                                    )}
                                </small>

                            </div>


                            ${
                                pending
                                    ? `
                                        <div class="admin-request-buttons">

                                            <button
                                                type="button"
                                                class="approve-request"
                                                onclick="reviewAdminRequest(
                                                    '${order.key}',
                                                    '${request.id}',
                                                    'Approved',
                                                    this
                                                )">
                                                Approve
                                            </button>

                                            <button
                                                type="button"
                                                class="reject-request"
                                                onclick="reviewAdminRequest(
                                                    '${order.key}',
                                                    '${request.id}',
                                                    'Rejected'
                                                )">
                                                Reject
                                            </button>

                                        </div>
                                    `
                                    : ""
                            }

                        </div>
                    `;
                }
            )
            .join("");


    return `
        <div class="admin-order-requests">

            <h4>Customer Requests</h4>

            ${requestsHTML}

        </div>
    `;
}


/* =====================================================
   UPDATE TRACKING STATUS
===================================================== */
window.updateAdminOrderStatus =
    async function (
        orderKey,
        newStatus
    ) {
        const order =
            ordersByKey.get(orderKey);


        if (!order) {
            return;
        }


        try {
            const normalizedNewStatus =
                normalizeStatus(
                    newStatus
                );


            /* OTHER STATUS UPDATES */

            if (
                normalizedNewStatus !==
                "confirmed"
            ) {
                const updateData = {
                    status:
                        newStatus,

                    updatedAt:
                        new Date()
                            .toISOString()
                };


                if (
                    normalizedNewStatus ===
                    "delivered"
                ) {
                    updateData.deliveredAt =
                        new Date()
                            .toISOString();
                }


                await updateDoc(
                    order.reference,
                    updateData
                );


            } else {
                /* CONFIRM ORDER + REDUCE STOCK */

                const orderItems =
                    Array.isArray(
                        order.data.items
                    ) &&
                    order.data.items.length > 0
                        ? order.data.items
                        : [
                            {
                                name:
                                    order.data.products,

                                quantity:
                                    Number(
                                        order.data.quantity
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

                        name:
                            item.name,

                        quantity:
                            Number(
                                item.quantity
                            ) || 1
                    });
                }


                await runTransaction(
                    db,
                    async function (
                        transaction
                    ) {
                        const snapshots =
                            await Promise.all([
                                transaction.get(
                                    order.reference
                                ),

                                ...productEntries.map(
                                    entry =>
                                        transaction.get(
                                            entry.reference
                                        )
                                )
                            ]);


                        const latestOrderSnapshot =
                            snapshots[0];


                        if (
                            !latestOrderSnapshot.exists()
                        ) {
                            throw new Error(
                                "Order not found."
                            );
                        }


                        const latestOrder =
                            latestOrderSnapshot.data();


                        /* PREVENT DOUBLE STOCK REDUCTION */

                        if (
                            latestOrder.stockDeducted ===
                            true
                        ) {
                            transaction.update(
                                order.reference,
                                {
                                    status:
                                        "Confirmed",

                                    updatedAt:
                                        new Date()
                                            .toISOString()
                                }
                            );

                            return;
                        }


                        /* CHECK AVAILABLE STOCK */

                        productEntries.forEach(
                            (entry, index) => {
                                const productSnapshot =
                                    snapshots[index + 1];

                                const currentStock =
                                    Number(
                                        productSnapshot
                                            .data()
                                            .stock
                                    ) || 0;


                                if (
                                    currentStock <
                                    entry.quantity
                                ) {
                                    throw new Error(
                                        "Only " +
                                        currentStock +
                                        " " +
                                        entry.name +
                                        " available."
                                    );
                                }
                            }
                        );


                        /* REDUCE STOCK */

                        productEntries.forEach(
                            (entry, index) => {
                                const productSnapshot =
                                    snapshots[index + 1];

                                const currentStock =
                                    Number(
                                        productSnapshot
                                            .data()
                                            .stock
                                    ) || 0;


                                transaction.update(
                                    entry.reference,
                                    {
                                        stock:
                                            currentStock -
                                            entry.quantity
                                    }
                                );
                            }
                        );


                        transaction.update(
                            order.reference,
                            {
                                status:
                                    "Confirmed",

                                stockDeducted:
                                    true,

                                stockRestored:
                                    false,

                                updatedAt:
                                    new Date()
                                        .toISOString()
                            }
                        );
                    }
                );
            }


            showAdminNotice(
                "Order status updated successfully.",
                true
            );


            await loadAllOrders();


        } catch (error) {
            showAdminNotice(
                error.message ||
                "Unable to update order status."
            );

            console.error(error);

            await loadAllOrders();
        }
    };

/* =====================================================
   UPDATE PAYMENT STATUS
===================================================== */

window.updateAdminPaymentStatus =
    async function (
        orderKey,
        newStatus
    ) {
        const order =
            ordersByKey.get(
                orderKey
            );


        if (!order) {
            return;
        }


        try {
            await updateDoc(
                order.reference,
                {
                    paymentStatus:
                        newStatus,

                    updatedAt:
                        new Date()
                            .toISOString()
                }
            );


            showAdminNotice(
                "Payment status updated successfully.",
                true
            );


            await loadAllOrders();

        } catch (error) {
            showAdminNotice(
                "Unable to update payment status."
            );

            console.error(error);
        }
    };


/* =====================================================
   APPROVE / REJECT REQUEST
===================================================== */
window.reviewAdminRequest =
    async function (
        orderKey,
        requestId,
        decision,
        actionButton
    ) {
        const order =
            ordersByKey.get(orderKey);


        if (
            !order ||
            !order.requests[requestId]
        ) {
            showAdminNotice(
                "Unable to find the latest request."
            );

            return;
        }


        const request =
            order.requests[requestId];
        const approvalKey =
            orderKey + ":" + requestId;
        const isCancellationApproval =
            requestId === "cancel" &&
            decision === "Approved";

        if (
            isCancellationApproval &&
            requestReviewInFlight.has(
                approvalKey
            )
        ) {
            return;
        }

        if (isCancellationApproval) {
            requestReviewInFlight.add(
                approvalKey
            );

            if (actionButton) {
                actionButton.disabled = true;
                actionButton.textContent =
                    "Approving...";
            }
        }


        try {
            /* APPROVE CANCELLATION */

            if (isCancellationApproval) {
                const reviewedAt =
                    new Date()
                        .toISOString();
                const latestOrderSnapshot =
                    await getDoc(
                        order.reference
                    );
                const latestRequestSnapshot =
                    await getDoc(
                        request.reference
                    );

                if (
                    !latestOrderSnapshot.exists()
                ) {
                    throw new Error(
                        "Order not found."
                    );
                }

                if (
                    !latestRequestSnapshot.exists()
                ) {
                    throw new Error(
                        "Cancellation request not found."
                    );
                }

                const latestOrder =
                    latestOrderSnapshot.data();
                const latestRequest =
                    latestRequestSnapshot.data();

                if (
                    latestRequest.status !==
                    "Requested"
                ) {
                    throw new Error(
                        "This cancellation request has already been reviewed."
                    );
                }

                const orderItems =
                    Array.isArray(
                        latestOrder.items
                    ) &&
                    latestOrder.items.length > 0
                        ? latestOrder.items
                        : [
                            {
                                name:
                                    latestOrder.products,

                                quantity:
                                    Number(
                                        latestOrder.quantity
                                    ) || 1
                            }
                        ];

                const productEntries = [];

                /* FIND PRODUCTS */

                if (
                    latestOrder.stockDeducted ===
                    true
                ) {
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

                        if (
                            productSnapshot.empty
                        ) {
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
                }


                await runTransaction(
                    db,
                    async function (
                        transaction
                    ) {
                        const snapshots =
                            await Promise.all([
                                transaction.get(
                                    order.reference
                                ),
                                transaction.get(
                                    request.reference
                                ),

                                ...productEntries.map(
                                    entry =>
                                        transaction.get(
                                            entry.reference
                                        )
                                )
                            ]);


                        const latestOrderSnapshot =
                            snapshots[0];
                        const latestRequestSnapshot =
                            snapshots[1];


                        if (
                            !latestOrderSnapshot.exists()
                        ) {
                            throw new Error(
                                "Order not found."
                            );
                        }

                        if (
                            !latestRequestSnapshot.exists()
                        ) {
                            throw new Error(
                                "Cancellation request not found."
                            );
                        }

                        if (
                            latestRequestSnapshot
                                .data()
                                .status !==
                            "Requested"
                        ) {
                            throw new Error(
                                "This cancellation request has already been reviewed."
                            );
                        }


                        const latestOrder =
                            latestOrderSnapshot.data();


                        if (
                            normalizeStatus(
                                latestOrder.status
                            ) === "cancelled"
                        ) {
                            throw new Error(
                                "Order is already cancelled."
                            );
                        }


                        const shouldRestoreStock =
    latestOrder.stockDeducted === true &&
    latestOrder.stockRestored !== true;


                        /* RESTORE STOCK ONLY IF IT WAS DEDUCTED */

if (shouldRestoreStock) {
    productEntries.forEach(
        (entry, index) => {
            const productSnapshot =
        snapshots[index + 2];

            const currentStock =
                Number(
                    productSnapshot
                        .data()
                        .stock
                ) || 0;

            transaction.update(
                entry.reference,
                {
                    stock:
                        currentStock +
                        entry.quantity
                }
            );
        }
    );
}
                        /* APPROVE REQUEST */

                        transaction.update(
                            request.reference,
                            {
                                status:
                                    "Approved",

                                reviewedAt:
                                    reviewedAt
                            }
                        );


                        /* CANCEL ORDER */

                        transaction.update(
                            order.reference,
                            {
                                status:
                                    "Cancelled",

                                stockRestored:
                                    shouldRestoreStock ||
                                    latestOrder
                                        .stockRestored ===
                                        true,

                                cancelRequest: {
                                    type:
                                        "cancel",

                                    reason:
                                        latestRequestSnapshot
                                            .data()
                                            .reason ||
                                        request.reason ||
                                        "",

                                    status:
                                        "Approved",

                                    requestedAt:
                                        latestRequestSnapshot
                                            .data()
                                            .requestedAt ||
                                        reviewedAt,

                                    reviewedAt:
                                        reviewedAt
                                },

                                cancelledAt:
                                    reviewedAt,

                                updatedAt:
                                    reviewedAt
                            }
                        );
                    }
                );


            } else {
                /* REJECT OR OTHER REQUEST */

                await updateDoc(
                    request.reference,
                    {
                        status:
                            decision,

                        reviewedAt:
                            new Date()
                                .toISOString()
                    }
                );
            }


            showAdminNotice(
                requestId +
                " request " +
                decision.toLowerCase() +
                ".",
                true
            );


            await loadAllOrders();


        } catch (error) {
            if (
                isCancellationApproval &&
                actionButton
            ) {
                actionButton.disabled = false;
                actionButton.textContent =
                    "Approve";
            }

            showAdminNotice(
                error.message ||
                "Unable to review request."
            );

            console.error(error);
        } finally {
            if (isCancellationApproval) {
                requestReviewInFlight.delete(
                    approvalKey
                );
            }
        }
    };
 /* =====================================================
   DASHBOARD CARD FILTERS
===================================================== */

function selectDashboardFilter(
    filter,
    selectedCard
) {
    activeDashboardFilter =
        filter;

    adminStatusFilter.value =
        "all";


    [
    adminTotalOrdersCard,
    adminNewOrdersCard,
    adminShippedOrdersCard,
    adminRequestsCard
].forEach(card => {
        if (card) {
            card.classList.remove(
                "active"
            );
        }
    });


    if (selectedCard) {
        selectedCard.classList.add(
            "active"
        );
    }


    applyOrderFilters();


    const ordersSection =
        document.querySelector(
            ".admin-orders-section"
        );

    if (ordersSection) {
        ordersSection.scrollIntoView({
            behavior:
                "smooth"
        });
    }
}


if (adminTotalOrdersCard) {
    adminTotalOrdersCard.addEventListener(
        "click",
        function () {
            selectDashboardFilter(
                "all",
                adminTotalOrdersCard
            );
        }
    );
}


if (adminNewOrdersCard) {
    adminNewOrdersCard.addEventListener(
        "click",
        function () {
            selectDashboardFilter(
                "new",
                adminNewOrdersCard
            );
        }
    );
}


if (adminShippedOrdersCard) {
    adminShippedOrdersCard.addEventListener(
        "click",
        function () {
            selectDashboardFilter(
                "shipped",
                adminShippedOrdersCard
            );
        }
    );
}


if (adminRequestsCard) {
    adminRequestsCard.addEventListener(
        "click",
        function () {
            selectDashboardFilter(
                "requests",
                adminRequestsCard
            );
        }
    );
}


/* =====================================================
   SEARCH + FILTER EVENTS
===================================================== */

adminOrderSearch.addEventListener(
    "input",
    applyOrderFilters
);


adminStatusFilter.addEventListener(
    "change",
    applyOrderFilters
);


refreshOrdersButton.addEventListener(
    "click",
    loadAllOrders
);


/* =====================================================
   LOGOUT
===================================================== */

adminLogoutButton.addEventListener(
    "click",
    async function () {
        if (
            !window.confirm(
                "Are you sure you want to log out?"
            )
        ) {
            return;
        }

        adminLogoutButton.disabled =
            true;


        adminLogoutButton.textContent =
            "Logging Out...";


        try {
            await signOut(auth);

            window.location.href =
                "login.html";

        } catch (error) {
            adminLogoutButton.disabled =
                false;


            adminLogoutButton.textContent =
                "Logout";


            showAdminNotice(
                "Unable to logout."
            );
        }
    }
);


/* =====================================================
   HELPERS
===================================================== */

function setRefreshLoading(loading) {
    refreshOrdersButton.disabled =
        loading;


    refreshOrdersButton.textContent =
        loading
            ? "Loading..."
            : "↻ Refresh Orders";
}


function showAdminNotice(
    message,
    success = false
) {
    adminAccessMessage.style.display =
        "block";


    adminAccessMessage.textContent =
        message;


    adminAccessMessage.classList.toggle(
        "success",
        success
    );


    adminAccessMessage.classList.toggle(
        "error",
        !success
    );


    setTimeout(function () {
        adminAccessMessage.style.display =
            "none";
    }, 2500);
}


function normalizeStatus(status) {
    return String(status || "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}


function formatDate(dateValue) {
    if (!dateValue) {
        return "";
    }


    const date =
        new Date(dateValue);


    if (Number.isNaN(date.getTime())) {
        return "";
    }


    return date.toLocaleString(
        "en-IN"
    );
}


function escapeHTML(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =====================================================
   ADMIN ADD PRODUCT
===================================================== */

const adminProductForm =
    document.getElementById("adminProductForm");

const adminProductName =
    document.getElementById("adminProductName");

const adminProductPrice =
    document.getElementById("adminProductPrice");
const adminProductStock =
    document.getElementById("adminProductStock");

const adminProductImage =
    document.getElementById("adminProductImage");

const adminProductImageFile =
    document.getElementById("adminProductImageFile");

const adminProductDescription =
    document.getElementById("adminProductDescription");

const adminProductMessage =
    document.getElementById("adminProductMessage");

const adminAddProductButton =
    document.getElementById("adminAddProductButton");

const adminProductPreview =
    document.getElementById("adminProductPreview");

const adminProductPreviewImage =
    document.getElementById(
        "adminProductPreviewImage"
    );


/* =====================================================
   PRODUCT IMAGE VALIDATION & CLOUDINARY UPLOAD HELPERS
===================================================== */

const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
]);

const DEFAULT_CLOUDINARY_CONFIG = {
    cloudName: "vgjfpkoh",
    uploadPreset: "alora_products"
};

function getCloudinaryConfig() {
    const userConfig = (typeof window !== "undefined" && window.ALORA_CLOUDINARY_CONFIG) || {};
    return {
        cloudName: (userConfig.cloudName || DEFAULT_CLOUDINARY_CONFIG.cloudName || "").trim(),
        uploadPreset: (userConfig.uploadPreset || DEFAULT_CLOUDINARY_CONFIG.uploadPreset || "").trim()
    };
}

function sanitizeProductFileName(fileName) {
    if (!fileName || typeof fileName !== "string") {
        return "image.jpg";
    }
    const lastDotIndex = fileName.lastIndexOf(".");
    const ext = lastDotIndex !== -1 ? fileName.slice(lastDotIndex).toLowerCase() : ".jpg";
    const nameWithoutExt = lastDotIndex !== -1 ? fileName.slice(0, lastDotIndex) : fileName;
    const safeBase = nameWithoutExt
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    return (safeBase || "product") + safeExt;
}

function validateProductImageFile(file) {
    if (!file) {
        return { valid: false, error: "No image file selected." };
    }

    const fileType = (file.type || "").toLowerCase();
    const fileName = (file.name || "").toLowerCase();
    const hasValidExt = /\.(jpe?g|png|webp)$/i.test(fileName);
    const isImageMime = fileType.startsWith("image/");

    if (!isImageMime && !hasValidExt) {
        return { valid: false, error: "Only image files (JPG, PNG, WebP) are allowed." };
    }

    if (fileType && !ALLOWED_IMAGE_MIME_TYPES.has(fileType) && !hasValidExt) {
        return { valid: false, error: "Unsupported image format. Please select a JPG, PNG, or WebP image." };
    }

    if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return { valid: false, error: `Image file is too large (${sizeMB} MB). Maximum allowed size is 5 MB.` };
    }

    return { valid: true };
}

async function uploadProductImageToCloudinary(file, progressCallback) {
    const validation = validateProductImageFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const config = getCloudinaryConfig();
    if (!config.cloudName || config.cloudName === "YOUR_CLOUD_NAME") {
        throw new Error("Cloudinary cloudName is not configured. Please set window.ALORA_CLOUDINARY_CONFIG.cloudName.");
    }
    if (!config.uploadPreset || config.uploadPreset === "YOUR_UNSIGNED_UPLOAD_PRESET") {
        throw new Error("Cloudinary uploadPreset is not configured. Please set window.ALORA_CLOUDINARY_CONFIG.uploadPreset.");
    }

    if (typeof progressCallback === "function") {
        progressCallback("Uploading image to Cloudinary...");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", config.uploadPreset);
    formData.append("folder", "alora_products");

    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`;

    let response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            body: formData
        });
    } catch (networkError) {
        throw new Error(`Cloudinary network connection error: ${networkError.message}`);
    }

    let responseData;
    try {
        responseData = await response.json();
    } catch (parseError) {
        throw new Error(`Cloudinary response parse failed: ${parseError.message} (HTTP ${response.status})`);
    }

    if (!response.ok || responseData.error) {
        const errorMsg = (responseData && responseData.error && responseData.error.message)
            ? responseData.error.message
            : `Upload failed with status ${response.status} ${response.statusText}`;
        throw new Error(`Cloudinary Error: ${errorMsg}`);
    }

    const secureUrl = responseData.secure_url || responseData.url;
    if (!secureUrl || typeof secureUrl !== "string") {
        throw new Error("Cloudinary upload succeeded but no valid image URL was returned.");
    }

    return {
        secure_url: secureUrl,
        public_id: responseData.public_id,
        format: responseData.format,
        width: responseData.width,
        height: responseData.height
    };
}

window.validateProductImageFile = validateProductImageFile;
window.sanitizeProductFileName = sanitizeProductFileName;
window.uploadProductImageToCloudinary = uploadProductImageToCloudinary;
window.getCloudinaryConfig = getCloudinaryConfig;


/* =====================================================
   PRODUCT IMAGE PREVIEW
===================================================== */

if (
    adminProductImage &&
    adminProductPreview &&
    adminProductPreviewImage
) {
    adminProductImage.addEventListener(
        "input",
        function () {
            const imageURL =
                adminProductImage.value.trim();

            if (!imageURL) {
                adminProductPreview.hidden = true;

                adminProductPreviewImage.src = "";

                return;
            }

            adminProductPreviewImage.src =
                imageURL;

            adminProductPreview.hidden = false;
        }
    );


    adminProductPreviewImage.addEventListener(
        "error",
        function () {
            adminProductPreview.hidden = true;

            const typedUrl =
                adminProductImage ? adminProductImage.value.trim() : "";
            if (typedUrl) {
                showAdminProductMessage(
                    "Please enter a valid product image URL.",
                    "error"
                );
            }
        }
    );


    adminProductPreviewImage.addEventListener(
        "load",
        function () {
            adminProductPreview.hidden = false;
        }
    );
}

let currentSelectedProductFile = null;

if (
    adminProductImageFile &&
    adminProductPreview &&
    adminProductPreviewImage
) {
    adminProductImageFile.addEventListener(
        "change",
        function (event) {
            const file =
                event.target.files &&
                event.target.files[0];

            if (!file) {
                currentSelectedProductFile = null;
                return;
            }

            const validation = validateProductImageFile(file);
            if (!validation.valid) {
                currentSelectedProductFile = null;
                showAdminProductMessage(validation.error, "error");
                adminProductImageFile.value = "";
                adminProductPreview.hidden = true;
                adminProductPreviewImage.src = "";
                return;
            }

            currentSelectedProductFile = file;

            // Clear manual text input so there is no confusion
            if (adminProductImage) {
                adminProductImage.value = "";
            }

            if (adminProductMessage) {
                adminProductMessage.textContent = "";
                adminProductMessage.className = "admin-product-message";
            }

            const reader = new FileReader();

            reader.onload = function (e) {
                adminProductPreviewImage.src =
                    e.target.result;

                adminProductPreview.hidden = false;
            };

            reader.readAsDataURL(file);
        }
    );
}



/* =====================================================
   SAVE PRODUCT TO FIRESTORE
===================================================== */

if (adminProductForm) {
    adminProductForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            const name =
                adminProductName.value.trim();

            const price =
                Number(adminProductPrice.value);
            const stock =
                Number(adminProductStock.value);

            const manualImage =
                adminProductImage ? adminProductImage.value.trim() : "";

            const description =
                adminProductDescription.value.trim();

            const selectedFile =
                currentSelectedProductFile ||
                (adminProductImageFile &&
                adminProductImageFile.files &&
                adminProductImageFile.files[0]) ||
                null;

            if (
                !name ||
                !price ||
                (!manualImage && !selectedFile) ||
                !description
            ) {
                showAdminProductMessage(
                    "Please fill all required details and select or enter an image.",
                    "error"
                );

                return;
            }


            if (price <= 0) {
                showAdminProductMessage(
                    "Please enter a valid product price.",
                    "error"
                );

                return;
            }

            if (
                !Number.isInteger(stock) ||
                stock < 0
            ) {
                showAdminProductMessage(
                    "Please enter a valid stock quantity.",
                    "error"
                );

                return;
            }

            if (selectedFile) {
                const validation = validateProductImageFile(selectedFile);
                if (!validation.valid) {
                    showAdminProductMessage(validation.error, "error");
                    return;
                }
            } else if (manualImage) {
                // Reject relative or local file paths (such as images/...)
                if (manualImage.startsWith("images/") || !/^https?:\/\//i.test(manualImage)) {
                    showAdminProductMessage(
                        "Local file paths (such as 'images/...') cannot be saved. Please select a photo from your device/gallery or provide a valid https:// image URL.",
                        "error"
                    );
                    return;
                }
            }

            if (adminAddProductButton) {
                adminAddProductButton.disabled = true;

                adminAddProductButton.textContent =
                    selectedFile ? "Uploading Image..." : "Adding Product...";
            }


            try {
                let finalImageUrl = "";

                if (selectedFile) {
                    // Log selected file
                    console.log("[ALORA PRODUCT UPLOAD DEBUG] selected file:", selectedFile);

                    showAdminProductMessage(
                        "Uploading image to Cloudinary...",
                        "loading"
                    );

                    // Upload selected File object to Cloudinary first using cloudName and uploadPreset
                    const uploadResult = await uploadProductImageToCloudinary(
                        selectedFile,
                        function (statusText) {
                            if (adminAddProductButton) {
                                adminAddProductButton.textContent = statusText;
                            }
                        }
                    );

                    // Log Cloudinary response
                    console.log("[ALORA PRODUCT UPLOAD DEBUG] Cloudinary response:", uploadResult);

                    // Read response.secure_url
                    const secureUrl = uploadResult && (uploadResult.secure_url || uploadResult.url);

                    // Log secure_url
                    console.log("[ALORA PRODUCT UPLOAD DEBUG] secure_url:", secureUrl);

                    // If upload fails or secure_url is missing, do not create product
                    if (!secureUrl || typeof secureUrl !== "string" || !/^https?:\/\//i.test(secureUrl)) {
                        throw new Error("Cloudinary did not return a valid secure URL. Product creation aborted.");
                    }

                    // Gallery Cloudinary URL strictly takes priority over manual input
                    finalImageUrl = secureUrl;
                } else if (manualImage) {
                    if (manualImage.startsWith("images/") || !/^https?:\/\//i.test(manualImage)) {
                        throw new Error("Local file paths (such as 'images/...') cannot be saved. Please select a photo from your device/gallery or provide a valid https:// image URL.");
                    }
                    finalImageUrl = manualImage;
                } else {
                    throw new Error("No image provided. Please select a photo from your gallery or enter an image URL.");
                }

                // Final strict guard: under NO circumstance can finalImageUrl be a relative path or non-http
                if (!finalImageUrl || !/^https?:\/\//i.test(finalImageUrl) || finalImageUrl.startsWith("images/")) {
                    throw new Error("Invalid product image: only secure web URLs (https://...) are allowed in Firestore.");
                }

                // Log final Firestore image value
                console.log("[ALORA PRODUCT UPLOAD DEBUG] final Firestore image value:", finalImageUrl);

                if (adminAddProductButton) {
                    adminAddProductButton.textContent =
                        "Saving Product...";
                }

                // Only after that save the Firestore product document
                const productsReference =
                    collection(db, "products");
                const newDocRef =
                    doc(productsReference);

                const catEl = document.getElementById("adminProductCategory");
                const badgeEl = document.getElementById("adminProductBadge");
                const categoryVal = catEl ? catEl.value.trim() : "";
                const badgeVal = badgeEl ? badgeEl.value.trim() : "";

                const productData = {
                    name: name,
                    price: price,
                    stock: stock,
                    image: finalImageUrl,
                    description: description,
                    active: true,
                    createdAt: serverTimestamp(),
                    createdAtISO: new Date().toISOString()
                };
                if (categoryVal) productData.category = categoryVal;
                if (badgeVal) productData.badge = badgeVal;

                await setDoc(newDocRef, productData);

                await loadAdminProducts();

                showAdminProductMessage(
                    "✓ Product added successfully.",
                    "success"
                );

                adminProductForm.reset();
                currentSelectedProductFile = null;

                if (adminProductPreview) {
                    adminProductPreview.hidden = true;
                }

                if (adminProductPreviewImage) {
                    adminProductPreviewImage.src = "";
                }

            } catch (error) {
                console.error(
                    "[ALORA PRODUCT UPLOAD DEBUG] Product adding failed:",
                    error
                );

                showAdminProductMessage(
                    "Unable to add product: " + (error.message || "Upload failed."),
                    "error"
                );

            } finally {
                if (adminAddProductButton) {
                    adminAddProductButton.disabled = false;

                    adminAddProductButton.textContent =
                        "+ Add Product";
                }
            }
        }
    );
}


/* =====================================================
   PRODUCT FORM MESSAGE
===================================================== */

function showAdminProductMessage(
    message,
    type
) {
    if (!adminProductMessage) {
        return;
    }

    adminProductMessage.textContent =
        message;

    adminProductMessage.className =
        "admin-product-message " + type;
}
/* =====================================================
   ADMIN MANAGE PRODUCTS
===================================================== */

const adminProductsList =
    document.getElementById("adminProductsList");

const adminProductSearch =
    document.getElementById("adminProductSearch");

const adminProductFilter =
    document.getElementById("adminProductFilter");

const adminReloadProducts =
    document.getElementById("adminReloadProducts");


const adminProductModal =
    document.getElementById("adminProductModal");

const adminProductModalOverlay =
    document.getElementById(
        "adminProductModalOverlay"
    );

const adminProductModalClose =
    document.getElementById(
        "adminProductModalClose"
    );


const adminEditProductForm =
    document.getElementById(
        "adminEditProductForm"
    );

const adminEditProductId =
    document.getElementById(
        "adminEditProductId"
    );

const adminEditProductName =
    document.getElementById(
        "adminEditProductName"
    );

const adminEditProductPrice =
    document.getElementById(
        "adminEditProductPrice"
    );
    const adminEditProductStock =
    document.getElementById(
        "adminEditProductStock"
    );

const adminEditProductImage =
    document.getElementById(
        "adminEditProductImage"
    );

const adminEditProductImageFile =
    document.getElementById(
        "adminEditProductImageFile"
    );

const adminEditProductPreview =
    document.getElementById(
        "adminEditProductPreview"
    );

const adminEditProductPreviewImage =
    document.getElementById(
        "adminEditProductPreviewImage"
    );

if (
    adminEditProductImage &&
    adminEditProductPreview &&
    adminEditProductPreviewImage
) {
    adminEditProductImage.addEventListener("input", function () {
        const val = adminEditProductImage.value.trim();
        if (!val) {
            adminEditProductPreview.hidden = true;
            adminEditProductPreviewImage.src = "";
            return;
        }
        adminEditProductPreviewImage.src = val;
        adminEditProductPreview.hidden = false;
    });
}

let currentSelectedEditProductFile = null;

if (
    adminEditProductImageFile &&
    adminEditProductPreview &&
    adminEditProductPreviewImage
) {
    adminEditProductImageFile.addEventListener("change", function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            currentSelectedEditProductFile = null;
            return;
        }

        const validation = validateProductImageFile(file);
        if (!validation.valid) {
            currentSelectedEditProductFile = null;
            showAdminEditMessage(validation.error, "error");
            adminEditProductImageFile.value = "";
            return;
        }

        currentSelectedEditProductFile = file;

        // Clear manual text input to avoid conflict
        if (adminEditProductImage) {
            adminEditProductImage.value = "";
        }

        if (adminEditProductMessage) {
            adminEditProductMessage.textContent = "";
            adminEditProductMessage.className = "admin-product-message";
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            adminEditProductPreviewImage.src = e.target.result;
            adminEditProductPreview.hidden = false;
        };
        reader.readAsDataURL(file);
    });
}

const adminEditProductDescription =
    document.getElementById(
        "adminEditProductDescription"
    );

const adminEditProductMessage =
    document.getElementById(
        "adminEditProductMessage"
    );

const adminSaveProductButton =
    document.getElementById(
        "adminSaveProductButton"
    );


let allAdminProducts = [];


/* =====================================================
   LOAD ADMIN PRODUCTS
===================================================== */

async function loadAdminProducts() {
    if (!adminProductsList) {
        return;
    }


    adminProductsList.innerHTML = `
        <div class="admin-loading">
            Loading products...
        </div>
    `;


    try {
        const productsSnapshot =
            await getDocs(
                collection(db, "products")
            );


        allAdminProducts = [];


        productsSnapshot.forEach(
            productDocument => {
                const product =
                    productDocument.data();


                allAdminProducts.push({
                    id: productDocument.id,

                    name:
                        product.name ||
                        "Alora Jewellery",

                    price:
                        Number(product.price) || 0,
                    stock:
    Number.isFinite(
        Number(product.stock)
    )
        ? Number(product.stock)
        : 0,

                    image:
                        product.image || "",

                    description:
                        product.description || "",

                    active:
                        product.active !== false
                });
            }
        );


        allAdminProducts.reverse();
        const lowStockProducts =
    allAdminProducts.filter(
        product =>
            product.active &&
            product.stock <= 5
    );

if (adminLowStockCount) {
    adminLowStockCount.textContent =
        lowStockProducts.length;
}

        filterAdminProducts();

    } catch (error) {
        console.error(
            "Admin products loading failed:",
            error
        );


        adminProductsList.innerHTML = `
            <div class="admin-products-error">
                Unable to load products.
            </div>
        `;
    }
}


/* =====================================================
   FILTER PRODUCTS
===================================================== */

function filterAdminProducts() {
    const searchValue =
        adminProductSearch
            ? adminProductSearch.value
                .toLowerCase()
                .trim()
            : "";


    const filterValue =
        adminProductFilter
            ? adminProductFilter.value
            : "all";


    const filteredProducts =
        allAdminProducts.filter(product => {

            const matchesSearch =
                product.name
                    .toLowerCase()
                    .includes(searchValue);


            let matchesFilter = true;


            if (filterValue === "active") {
                matchesFilter =
                    product.active === true;
            }


            if (filterValue === "hidden") {
                matchesFilter =
                    product.active === false;
            }
             if (filterValue === "low-stock") {
    matchesFilter =
        product.active === true &&
        product.stock <= 5;
}

            return (
                matchesSearch &&
                matchesFilter
            );
        });


    renderAdminProducts(
        filteredProducts
    );
}


/* =====================================================
   RENDER ADMIN PRODUCTS
===================================================== */

function renderAdminProducts(products) {
    if (!adminProductsList) {
        return;
    }


    adminProductsList.innerHTML = "";


    if (products.length === 0) {
        adminProductsList.innerHTML = `
            <div class="admin-products-empty">
                No products found.
            </div>
        `;

        return;
    }


    products.forEach(product => {
        const productItem =
            document.createElement("article");


        productItem.className =
            "admin-product-item";


        if (!product.active) {
            productItem.classList.add(
                "hidden-product"
            );
        }


        productItem.innerHTML = `
            <div class="admin-product-item-image">

                <img
                    src="${escapeAdminHTML(product.image)}"
                    alt="${escapeAdminHTML(product.name)}">

            </div>


            <div class="admin-product-item-info">

                <h3>
                    ${escapeAdminHTML(product.name)}
                </h3>

                <p class="admin-product-item-price">
                    ₹${product.price}
                </p>
               <p class="
    admin-product-item-stock
    ${
        product.stock <= 0
            ? "out-of-stock"
            : product.stock <= 5
                ? "low-stock"
                : "in-stock"
    }
">
    ${
        product.stock <= 0
            ? "Out of Stock"
            : product.stock <= 5
                ? "Only " +
                  product.stock +
                  " left"
                : "In Stock — " +
                  product.stock +
                  " available"
    }
</p>

                <p class="admin-product-item-description">
                    ${escapeAdminHTML(
                        product.description
                    )}
                </p>

                <span class="
                    admin-product-visibility
                    ${
                        product.active
                            ? "active"
                            : "hidden"
                    }
                ">
                    ${
                        product.active
                            ? "Active"
                            : "Hidden"
                    }
                </span>

            </div>


            <div class="admin-product-item-actions">

                <button
                    type="button"
                    class="admin-product-edit-button">
                    Edit
                </button>

                <button
                    type="button"
                    class="admin-product-toggle-button">
                    ${
                        product.active
                            ? "Hide"
                            : "Show"
                    }
                </button>

                <button
                    type="button"
                    class="admin-product-delete-button">
                    Delete
                </button>

            </div>
        `;


        const productImage =
            productItem.querySelector("img");


        productImage.addEventListener(
            "error",
            function () {
                productImage.src =
                    "https://placehold.co/300x300/f5f1eb/b68b00?text=Alora";
            }
        );


        const editButton =
            productItem.querySelector(
                ".admin-product-edit-button"
            );


        const toggleButton =
            productItem.querySelector(
                ".admin-product-toggle-button"
            );


        const deleteButton =
            productItem.querySelector(
                ".admin-product-delete-button"
            );


        editButton.addEventListener(
            "click",
            function () {
                openAdminProductEditor(
                    product
                );
            }
        );


        toggleButton.addEventListener(
            "click",
            async function () {
                await toggleAdminProduct(
                    product
                );
            }
        );


        deleteButton.addEventListener(
            "click",
            async function () {
                await deleteAdminProduct(
                    product
                );
            }
        );


        adminProductsList.appendChild(
            productItem
        );
    });
}


/* =====================================================
   OPEN PRODUCT EDITOR
===================================================== */

function openAdminProductEditor(product) {
    if (!adminProductModal) {
        return;
    }


    adminEditProductId.value =
        product.id;

    adminEditProductName.value =
        product.name;

    adminEditProductPrice.value =
        product.price;
     adminEditProductStock.value =
    product.stock;

    adminEditProductImage.value =
        product.image;

    adminEditProductDescription.value =
        product.description;

    const adminEditProductCategory = document.getElementById("adminEditProductCategory");
    if (adminEditProductCategory) {
        adminEditProductCategory.value = product.category || "";
    }

    const adminEditProductBadge = document.getElementById("adminEditProductBadge");
    if (adminEditProductBadge) {
        adminEditProductBadge.value = product.badge || "";
    }

    if (adminEditProductImageFile) {
        adminEditProductImageFile.value = "";
    }

    if (adminEditProductPreview && adminEditProductPreviewImage) {
        if (product.image) {
            adminEditProductPreviewImage.src = product.image;
            adminEditProductPreview.hidden = false;
        } else {
            adminEditProductPreview.hidden = true;
            adminEditProductPreviewImage.src = "";
        }
    }

    adminEditProductMessage.textContent = "";

    adminEditProductMessage.className =
        "admin-product-message";


    adminProductModal.hidden = false;

    document.body.style.overflow =
        "hidden";
}


/* =====================================================
   CLOSE PRODUCT EDITOR
===================================================== */

function closeAdminProductEditor() {
    if (!adminProductModal) {
        return;
    }


    adminProductModal.hidden = true;

    document.body.style.overflow = "";
}

window.openAdminProductEditor = openAdminProductEditor;
window.closeAdminProductEditor = closeAdminProductEditor;


if (adminProductModalClose) {
    adminProductModalClose.addEventListener(
        "click",
        closeAdminProductEditor
    );
}


if (adminProductModalOverlay) {
    adminProductModalOverlay.addEventListener(
        "click",
        closeAdminProductEditor
    );
}


/* =====================================================
   SAVE PRODUCT CHANGES
===================================================== */

if (adminEditProductForm) {
    adminEditProductForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            const productId =
                adminEditProductId ? adminEditProductId.value : "";

            const name =
                adminEditProductName.value.trim();

            const price =
                Number(adminEditProductPrice.value);
            const stock =
                Number(adminEditProductStock.value);

            const manualImage =
                adminEditProductImage ? adminEditProductImage.value.trim() : "";

            const description =
                adminEditProductDescription.value.trim();

            const selectedEditFile =
                currentSelectedEditProductFile ||
                (adminEditProductImageFile &&
                adminEditProductImageFile.files &&
                adminEditProductImageFile.files[0]) ||
                null;

            if (!Number.isInteger(stock) || stock < 0) {
                showAdminEditMessage(
                    "Please enter a valid stock quantity.",
                    "error"
                );
                return;
            }

            if (
                !productId ||
                !name ||
                !price ||
                (!manualImage && !selectedEditFile) ||
                !description
            ) {
                showAdminEditMessage(
                    "Please fill all product details.",
                    "error"
                );
                return;
            }

            if (selectedEditFile) {
                const validation = validateProductImageFile(selectedEditFile);
                if (!validation.valid) {
                    showAdminEditMessage(validation.error, "error");
                    return;
                }
            } else if (manualImage) {
                if (manualImage.startsWith("images/") || !/^https?:\/\//i.test(manualImage)) {
                    showAdminEditMessage(
                        "Local file paths (such as 'images/...') cannot be saved. Please select a photo from your device/gallery or provide a valid https:// image URL.",
                        "error"
                    );
                    return;
                }
            }

            if (adminSaveProductButton) {
                adminSaveProductButton.disabled = true;
                adminSaveProductButton.textContent =
                    selectedEditFile ? "Uploading Image..." : "Saving...";
            }

            try {
                let finalImageUrl = "";

                if (selectedEditFile) {
                    console.log("[ALORA PRODUCT EDIT DEBUG] selected file:", selectedEditFile);

                    showAdminEditMessage(
                        "Uploading image to Cloudinary...",
                        "loading"
                    );

                    const uploadResult = await uploadProductImageToCloudinary(
                        selectedEditFile,
                        function (statusText) {
                            if (adminSaveProductButton) {
                                adminSaveProductButton.textContent = statusText;
                            }
                        }
                    );

                    console.log("[ALORA PRODUCT EDIT DEBUG] Cloudinary response:", uploadResult);

                    const secureUrl = uploadResult && (uploadResult.secure_url || uploadResult.url);
                    console.log("[ALORA PRODUCT EDIT DEBUG] secure_url:", secureUrl);

                    if (!secureUrl || typeof secureUrl !== "string" || !/^https?:\/\//i.test(secureUrl)) {
                        throw new Error("Cloudinary did not return a valid secure URL. Product update aborted.");
                    }

                    finalImageUrl = secureUrl;
                    if (adminEditProductImage) {
                        adminEditProductImage.value = finalImageUrl;
                    }
                } else if (manualImage) {
                    if (manualImage.startsWith("images/") || !/^https?:\/\//i.test(manualImage)) {
                        throw new Error("Local file paths like 'images/...' cannot be saved. Please select a photo from your gallery or provide a valid https:// image URL.");
                    }
                    finalImageUrl = manualImage;
                } else {
                    throw new Error("No image selected for product update.");
                }

                if (!finalImageUrl || !/^https?:\/\//i.test(finalImageUrl) || finalImageUrl.startsWith("images/")) {
                    throw new Error("Invalid product image: only secure web URLs (https://...) are allowed in Firestore.");
                }

                console.log("[ALORA PRODUCT EDIT DEBUG] final Firestore image value:", finalImageUrl);

                if (adminSaveProductButton) {
                    adminSaveProductButton.textContent = "Saving Product...";
                }

                const adminEditProductCategory = document.getElementById("adminEditProductCategory");
                const adminEditProductBadge = document.getElementById("adminEditProductBadge");
                const editCategory = adminEditProductCategory ? adminEditProductCategory.value.trim() : "";
                const editBadge = adminEditProductBadge ? adminEditProductBadge.value.trim() : "";

                const updatePayload = {
                    name: name,
                    price: price,
                    stock: stock,
                    image: finalImageUrl,
                    description: description,
                    category: editCategory,
                    badge: editBadge,
                    updatedAt: serverTimestamp()
                };

                await updateDoc(
                    doc(db, "products", productId),
                    updatePayload
                );

                showAdminEditMessage(
                    "✓ Product updated successfully.",
                    "success"
                );

                await loadAdminProducts();

                currentSelectedEditProductFile = null;
                if (adminEditProductImageFile) {
                    adminEditProductImageFile.value = "";
                }

                setTimeout(
                    closeAdminProductEditor,
                    700
                );

            } catch (error) {
                console.error(
                    "Product update failed:",
                    error
                );

                showAdminEditMessage(
                    error.message || "Unable to update product.",
                    "error"
                );

            } finally {
                if (adminSaveProductButton) {
                    adminSaveProductButton.disabled = false;
                    adminSaveProductButton.textContent = "Save Changes";
                }
            }
        }
    );
}


/* =====================================================
   HIDE / SHOW PRODUCT
===================================================== */

async function toggleAdminProduct(product) {
    const action =
        product.active ? "hide" : "show";


    const confirmed =
        window.confirm(
            "Do you want to " +
            action +
            " " +
            product.name +
            "?"
        );


    if (!confirmed) {
        return;
    }


    try {
        await updateDoc(
            doc(
                db,
                "products",
                product.id
            ),
            {
                active: !product.active,

                updatedAt:
                    serverTimestamp()
            }
        );


        await loadAdminProducts();

    } catch (error) {
        console.error(
            "Product visibility update failed:",
            error
        );


        window.alert(
            "Unable to update product visibility."
        );
    }
}


/* =====================================================
   DELETE PRODUCT
===================================================== */

async function deleteAdminProduct(product) {
    const confirmed =
        window.confirm(
            "Permanently delete " +
            product.name +
            "?"
        );


    if (!confirmed) {
        return;
    }


    try {
        await deleteDoc(
            doc(
                db,
                "products",
                product.id
            )
        );


        await loadAdminProducts();

    } catch (error) {
        console.error(
            "Product delete failed:",
            error
        );


        window.alert(
            "Unable to delete product."
        );
    }
}


/* =====================================================
   EDIT MESSAGE
===================================================== */

function showAdminEditMessage(
    message,
    type
) {
    if (!adminEditProductMessage) {
        return;
    }


    adminEditProductMessage.textContent =
        message;

    adminEditProductMessage.className =
        "admin-product-message " + type;
}


/* =====================================================
   PRODUCT SEARCH AND FILTER
===================================================== */

if (adminProductSearch) {
    adminProductSearch.addEventListener(
        "input",
        filterAdminProducts
    );
}


if (adminProductFilter) {
    adminProductFilter.addEventListener(
        "change",
        filterAdminProducts
    );
}


if (adminReloadProducts) {
    adminReloadProducts.addEventListener(
        "click",
        loadAdminProducts
    );
}


/* =====================================================
   ESCAPE PRODUCT HTML
===================================================== */

function escapeAdminHTML(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   START PRODUCT MANAGEMENT
===================================================== */

loadAdminProducts();

/* =====================================================
   CUSTOMER REVIEWS MODERATION
===================================================== */

async function loadAdminReviews() {
    const adminReviewsList = document.getElementById("adminReviewsList");
    const adminTotalReviewsEl = document.getElementById("adminTotalReviews");
    if (!adminReviewsList) {
        return;
    }

    adminReviewsList.innerHTML = `
        <div class="admin-loading">
            Loading customer reviews...
        </div>
    `;

    try {
        const reviewsRef = collection(db, "reviews");
        const reviewsSnap = await getDocs(reviewsRef);

        const reviews = [];
        reviewsSnap.forEach(docSnap => {
            reviews.push({ id: docSnap.id, ...docSnap.data() });
        });

        reviews.sort((a, b) => {
            const timeA = a.createdAtISO || (a.createdAt && a.createdAt.seconds ? new Date(a.createdAt.seconds * 1000).toISOString() : "");
            const timeB = b.createdAtISO || (b.createdAt && b.createdAt.seconds ? new Date(b.createdAt.seconds * 1000).toISOString() : "");
            return timeB.localeCompare(timeA);
        });

        if (adminTotalReviewsEl) {
            adminTotalReviewsEl.textContent = reviews.length;
        }

        if (reviews.length === 0) {
            adminReviewsList.innerHTML = `
                <div style="text-align:center; padding: 25px; color: #888;">
                    No customer reviews submitted yet.
                </div>
            `;
            return;
        }

        adminReviewsList.innerHTML = "";

        reviews.forEach(review => {
            const item = document.createElement("div");
            item.className = "admin-review-item" + (review.status === "hidden" ? " hidden-review" : "");

            const rating = Number(review.rating) || 5;
            const safeRating = Math.min(5, Math.max(1, rating));
            const stars = "★".repeat(safeRating) + "☆".repeat(5 - safeRating);

            const dateStr = review.createdAtISO
                ? new Date(review.createdAtISO).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "Recently";

            const productImgHtml = review.productImage
                ? `<img src="${escapeAdminHTML(review.productImage)}" alt="${escapeAdminHTML(review.productName || 'Product')}" class="admin-review-thumb">`
                : `<div class="admin-review-thumb" style="display:flex;align-items:center;justify-content:center;color:#b68b00;font-size:24px;">★</div>`;

            item.innerHTML = `
                ${productImgHtml}
                <div class="admin-review-info">
                    <div class="admin-review-header">
                        <span class="admin-review-customer">${escapeAdminHTML(review.customerName || "Customer")}</span>
                        <span class="admin-review-stars">${stars}</span>
                        <span class="admin-review-date">${dateStr}</span>
                    </div>
                    <div class="admin-review-product">${escapeAdminHTML(review.productName || "Verified Purchase")}</div>
                    <div class="admin-review-text">${escapeAdminHTML(review.comment || "No comment provided.")}</div>
                </div>
                <div class="admin-review-actions">
                    <button type="button" class="admin-review-btn toggle" data-id="${escapeAdminHTML(review.id)}" data-status="${escapeAdminHTML(review.status || 'approved')}">
                        ${review.status === "hidden" ? "Approve" : "Hide"}
                    </button>
                    <button type="button" class="admin-review-btn delete" data-id="${escapeAdminHTML(review.id)}">
                        Delete
                    </button>
                </div>
            `;

            const toggleBtn = item.querySelector(".toggle");
            if (toggleBtn) {
                toggleBtn.addEventListener("click", async () => {
                    const currentStatus = toggleBtn.getAttribute("data-status");
                    const newStatus = currentStatus === "hidden" ? "approved" : "hidden";
                    toggleBtn.disabled = true;
                    toggleBtn.textContent = "Updating...";
                    try {
                        await updateDoc(doc(db, "reviews", review.id), { status: newStatus });
                        await loadAdminReviews();
                    } catch (err) {
                        console.error("Error updating review:", err);
                        alert("Could not update review status.");
                        toggleBtn.disabled = false;
                        toggleBtn.textContent = currentStatus === "hidden" ? "Approve" : "Hide";
                    }
                });
            }

            const deleteBtn = item.querySelector(".delete");
            if (deleteBtn) {
                deleteBtn.addEventListener("click", async () => {
                    if (!window.confirm("Are you sure you want to permanently delete this customer review?")) {
                        return;
                    }
                    deleteBtn.disabled = true;
                    deleteBtn.textContent = "Deleting...";
                    try {
                        await deleteDoc(doc(db, "reviews", review.id));
                        await loadAdminReviews();
                    } catch (err) {
                        console.error("Error deleting review:", err);
                        alert("Could not delete review.");
                        deleteBtn.disabled = false;
                        deleteBtn.textContent = "Delete";
                    }
                });
            }

            adminReviewsList.appendChild(item);
        });

    } catch (err) {
        console.error("Error loading reviews:", err);
        adminReviewsList.innerHTML = `
            <div style="text-align:center; padding: 25px; color: #c92a2a;">
                Failed to load reviews.
            </div>
        `;
    }
}

window.loadAdminReviews = loadAdminReviews;