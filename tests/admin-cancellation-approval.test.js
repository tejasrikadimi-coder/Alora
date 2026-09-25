const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "admin.js"),
    "utf8"
);
const start = source.indexOf(
    "window.reviewAdminRequest ="
);
const marker = source.indexOf(
    "DASHBOARD CARD FILTERS",
    start
);
const end = source.lastIndexOf(
    "/*",
    marker
);
assert.notEqual(start, -1);
assert.notEqual(end, -1);

function createHarness({
    orderData,
    requestData,
    productData,
    missingProduct = false
}) {
    const state = {
        order: { ...orderData },
        request: { ...requestData },
        product: productData
            ? { ...productData }
            : null,
        notices: [],
        updates: [],
        productQueries: 0,
        transactionCount: 0
    };
    const orderReference = "order-ref";
    const requestReference = "request-ref";
    const productReference = "product-ref";
    const button = {
        disabled: false,
        textContent: "Approve"
    };

    function snapshot(data) {
        return {
            exists: () => Boolean(data),
            data: () => ({ ...data })
        };
    }

    const context = {
        console,
        Date,
        Number,
        String,
        Promise,
        setTimeout,
        window: {},
        ordersByKey: null,
        requestReviewInFlight: new Set(),
        db: "mock-db",
        collection: () => "products-query",
        query: () => "products-query",
        where: () => "name-filter",
        getDoc: async reference => {
            if (reference === orderReference) {
                return snapshot(state.order);
            }
            if (reference === requestReference) {
                return snapshot(state.request);
            }
            throw new Error("Unexpected getDoc reference");
        },
        getDocs: async () => {
            state.productQueries += 1;
            if (missingProduct) {
                return { empty: true, docs: [] };
            }
            return {
                empty: false,
                docs: [
                    {
                        ref: productReference
                    }
                ]
            };
        },
        updateDoc: async (reference, data) => {
            state.updates.push({ reference, data });
            Object.assign(
                reference === requestReference
                    ? state.request
                    : state.order,
                data
            );
        },
        runTransaction: async (_db, callback) => {
            state.transactionCount += 1;
            const writes = [];
            const transaction = {
                get: async reference => {
                    if (reference === orderReference) {
                        return snapshot(state.order);
                    }
                    if (reference === requestReference) {
                        return snapshot(state.request);
                    }
                    if (reference === productReference) {
                        return snapshot(state.product);
                    }
                    throw new Error("Unexpected transaction read");
                },
                update: (reference, data) => {
                    writes.push({ reference, data });
                }
            };

            await callback(transaction);
            writes.forEach(write => {
                state.updates.push(write);
                if (write.reference === orderReference) {
                    Object.assign(state.order, write.data);
                } else if (write.reference === requestReference) {
                    Object.assign(state.request, write.data);
                } else if (write.reference === productReference) {
                    Object.assign(state.product, write.data);
                }
            });
        },
        showAdminNotice: (message, success) => {
            state.notices.push({ message, success });
        },
        loadAllOrders: async () => {},
        normalizeStatus: status =>
            String(status || "")
                .toLowerCase()
                .replace(/[^a-z]/g, "")
    };

    context.ordersByKey = new Map([
        [
            "order-key",
            {
                reference: orderReference,
                data: state.order,
                requests: {
                    cancel: {
                        id: "cancel",
                        reference: requestReference,
                        ...state.request
                    }
                }
            }
        ]
    ]);

    vm.runInNewContext(
        `
        const ordersByKey = context.ordersByKey;
        const requestReviewInFlight = context.requestReviewInFlight;
        const db = context.db;
        const collection = context.collection;
        const query = context.query;
        const where = context.where;
        const getDoc = context.getDoc;
        const getDocs = context.getDocs;
        const updateDoc = context.updateDoc;
        const runTransaction = context.runTransaction;
        const showAdminNotice = context.showAdminNotice;
        const loadAllOrders = context.loadAllOrders;
        const normalizeStatus = context.normalizeStatus;
        ${source.slice(start, end)}
        `,
        vm.createContext({
            ...context,
            context,
            window: context.window
        })
    );

    return {
        approve: () =>
            context.window.reviewAdminRequest(
                "order-key",
                "cancel",
                "Approved",
                button
            ),
        reject: () =>
            context.window.reviewAdminRequest(
                "order-key",
                "cancel",
                "Rejected"
            ),
        state,
        button
    };
}

function baseOrder(overrides = {}) {
    return {
        status: "Order Received",
        stockDeducted: false,
        stockRestored: false,
        items: [{ name: "Ring", quantity: 1 }],
        ...overrides
    };
}

function baseRequest() {
    return {
        type: "cancel",
        reason: "Changed my mind",
        status: "Requested",
        requestedAt: "2026-09-10T10:00:00.000Z"
    };
}

async function testPendingApproval() {
    const harness = createHarness({
        orderData: baseOrder(),
        requestData: baseRequest(),
        productData: { stock: 4 }
    });

    await harness.approve();
    assert.equal(harness.state.productQueries, 0);
    assert.equal(harness.state.order.status, "Cancelled");
    assert.equal(harness.state.order.stockRestored, false);
    assert.equal(harness.state.request.status, "Approved");
    assert.equal(harness.button.textContent, "Approving...");
}

async function testConfirmedApproval() {
    const harness = createHarness({
        orderData: baseOrder({
            status: "Confirmed",
            stockDeducted: true
        }),
        requestData: baseRequest(),
        productData: { stock: 4 }
    });

    await harness.approve();
    assert.equal(harness.state.product.stock, 5);
    assert.equal(harness.state.order.stockRestored, true);
    assert.equal(harness.state.order.status, "Cancelled");
}

async function testRepeatApprovalDoesNotRestoreTwice() {
    const harness = createHarness({
        orderData: baseOrder({
            status: "Confirmed",
            stockDeducted: true
        }),
        requestData: baseRequest(),
        productData: { stock: 4 }
    });

    await harness.approve();
    const stockAfterFirstApproval =
        harness.state.product.stock;
    harness.button.textContent = "Approve";
    await harness.approve();
    assert.equal(
        harness.state.product.stock,
        stockAfterFirstApproval
    );
    assert.match(
        harness.state.notices.at(-1).message,
        /already been reviewed/
    );
}

async function testDuplicateClicksRunOnce() {
    const harness = createHarness({
        orderData: baseOrder(),
        requestData: baseRequest(),
        productData: { stock: 4 }
    });

    const first = harness.approve();
    const second = harness.approve();
    await Promise.all([first, second]);
    assert.equal(harness.state.transactionCount, 1);
}

async function testMissingProductRestoresButton() {
    const harness = createHarness({
        orderData: baseOrder({
            status: "Confirmed",
            stockDeducted: true
        }),
        requestData: baseRequest(),
        productData: { stock: 4 },
        missingProduct: true
    });

    await harness.approve();
    assert.equal(harness.button.disabled, false);
    assert.equal(harness.button.textContent, "Approve");
    assert.match(
        harness.state.notices.at(-1).message,
        /product not found/
    );
}

async function testRejectUnchanged() {
    const harness = createHarness({
        orderData: baseOrder(),
        requestData: baseRequest(),
        productData: { stock: 4 }
    });

    await harness.reject();
    assert.equal(harness.state.request.status, "Rejected");
    assert.equal(harness.state.order.status, "Order Received");
    assert.equal(harness.state.product.stock, 4);
}

(async () => {
    await testPendingApproval();
    console.log("PASS pending approval without stock restoration");
    await testConfirmedApproval();
    console.log("PASS confirmed approval restores stock once");
    await testRepeatApprovalDoesNotRestoreTwice();
    console.log("PASS repeat approval cannot restore stock twice");
    await testDuplicateClicksRunOnce();
    console.log("PASS duplicate clicks run one approval");
    await testMissingProductRestoresButton();
    console.log("PASS missing product restores button and reports error");
    await testRejectUnchanged();
    console.log("PASS reject behavior remains unchanged");
})().catch(error => {
    console.error("FAIL", error);
    process.exitCode = 1;
});
