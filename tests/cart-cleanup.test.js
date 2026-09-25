const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "script.js"),
    "utf8"
);

const elements = new Map();
function makeElement(id) {
    return {
        id,
        tagName: "INPUT",
        value: "",
        innerHTML: "",
        textContent: "",
        style: {},
        disabled: false,
        classList: {
            add() {},
            remove() {},
            toggle() {}
        },
        appendChild() {},
        addEventListener() {}
    };
}

[
    "wishlistGrid",
    "emptyWishlist",
    "cartItems",
    "emptyCart",
    "cartSummary",
    "cartItemCount",
    "grandTotal",
    "wishlistCountBadge",
    "cartCountBadge",
    "customerName",
    "phone",
    "address",
    "email",
    "productName",
    "productPrice",
    "totalPrice",
    "payment"
].forEach(function (id) {
    elements.set(id, makeElement(id));
});

const document = {
    addEventListener() {},
    getElementById(id) {
        return elements.get(id) || null;
    },
    querySelectorAll() {
        return [];
    },
    querySelector() {
        return makeElement("place-order");
    },
    createElement() {
        return makeElement("dynamic");
    }
};

const storage = new Map();
const localStorage = {
    getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
        storage.set(key, String(value));
    },
    removeItem(key) {
        storage.delete(key);
    }
};

let activeUid = "customer-a";
let cartDocuments = new Map([
    ["product-a", 2],
    ["product-b", 5]
]);
let failCommit = false;
let failRead = false;
let savedOrder = false;
let orderSaveShouldFail = true;
const alerts = [];

function makeSnapshot(documents) {
    const docs = documents.map(function ([id, quantity]) {
        return {
            id,
            ref: { id },
            data() {
                return {
                    productId: id,
                    quantity
                };
            }
        };
    });

    return {
        docs,
        forEach(callback) {
            docs.forEach(callback);
        }
    };
}

const firestore = {
    collection(_db, ...path) {
        return { path };
    },
    doc(_db, ...path) {
        return { id: path[path.length - 1] };
    },
    getDocs(reference) {
        if (failRead) {
            return Promise.reject(
                new Error("synthetic cart read failure")
            );
        }

        if (reference.path[0] === "products") {
            return Promise.resolve({
                docs: [{
                    id: "product-a",
                    data: () => ({
                        name: "Product A",
                        price: 100,
                        image: "a.jpg",
                        stock: 10,
                        active: true
                    })
                }, {
                    id: "product-b",
                    data: () => ({
                        name: "Product B",
                        price: 200,
                        image: "b.jpg",
                        stock: 10,
                        active: true
                    })
                }]
            });
        }

        return Promise.resolve(
            makeSnapshot(
                Array.from(cartDocuments.entries())
            )
        );
    },
    writeBatch() {
        const operations = [];
        return {
            set(reference, data) {
                operations.push({
                    type: "set",
                    id: reference.id,
                    data
                });
            },
            delete(reference) {
                operations.push({
                    type: "delete",
                    id: reference.id
                });
            },
            async commit() {
                if (failCommit) {
                    throw new Error(
                        "synthetic cart commit failure"
                    );
                }

                operations.forEach(function (operation) {
                    if (operation.type === "delete") {
                        cartDocuments.delete(operation.id);
                    } else {
                        cartDocuments.set(
                            operation.id,
                            operation.data.quantity
                        );
                    }
                });
            }
        };
    }
};

const firebase = {
    auth: {
        currentUser: {
            uid: activeUid
        }
    },
    db: {}
};

async function syntheticModule(exports) {
    const module = new vm.SyntheticModule(
        Object.keys(exports),
        function () {
            Object.entries(exports).forEach(
                ([name, value]) => this.setExport(name, value)
            );
        }
    );
    await module.link(() => {
        throw new Error("Unexpected synthetic import");
    });
    await module.evaluate();
    return module;
}

const context = vm.createContext({
    console,
    document,
    localStorage,
    window: {
        location: {
            search: "",
            href:
                "https://alora.example/order.html"
        },
        saveOrderToFirestore: async function () {
            savedOrder = true;
            if (orderSaveShouldFail) {
                throw new Error("synthetic order save failure");
            }
        }
    },
    URL,
    URLSearchParams,
    FormData,
    Promise,
    Map,
    Set,
    Number,
    String,
    Date,
    Math,
    JSON,
    alert(message) {
        alerts.push(message);
    },
    setTimeout() {},
    clearTimeout() {},
    fetch() {
        return Promise.resolve();
    }
});

const script = new vm.Script(source, {
    filename: "script.js",
    importModuleDynamically(specifier) {
        if (specifier === "./firebase.js") {
            return syntheticModule(firebase);
        }
        if (specifier.includes("firebase-firestore.js")) {
            return syntheticModule(firestore);
        }
        if (specifier.includes("firebase-auth.js")) {
            return syntheticModule({
                onAuthStateChanged() {}
            });
        }
        return Promise.reject(
            new Error(`Unexpected import: ${specifier}`)
        );
    }
});

(async function run() {
    script.runInContext(context);
    await vm.runInContext(
        "initializeAccountPersistence({ uid: 'customer-a' })",
        context
    );

    storage.set(
        "aloraCart",
        JSON.stringify([
            { id: "product-a", quantity: 2 },
            { id: "product-b", quantity: 5 }
        ])
    );

    await vm.runInContext(
        "cleanupPurchasedAccountCart(" +
        "'customer-a', 'order-1', " +
        "[{ id: 'product-a', quantity: 2 }])",
        context
    );
    assert.deepEqual(
        Array.from(cartDocuments.entries()),
        [["product-b", 5]]
    );
    console.log("PASS successful cart checkout removes purchased quantities");

    cartDocuments = new Map([
        ["product-a", 4],
        ["product-b", 5]
    ]);
    await vm.runInContext(
        "cleanupPurchasedAccountCart(" +
        "'customer-a', 'order-2', " +
        "[{ id: 'product-a', quantity: 2 }])",
        context
    );
    assert.deepEqual(
        Array.from(cartDocuments.entries()),
        [["product-a", 2], ["product-b", 5]]
    );
    console.log("PASS unrelated and newly added quantities survive");

    await vm.runInContext(
        "cleanupPurchasedAccountCart(" +
        "'customer-a', 'order-2', " +
        "[{ id: 'product-a', quantity: 2 }])",
        context
    );
    assert.deepEqual(
        Array.from(cartDocuments.entries()),
        [["product-a", 2], ["product-b", 5]]
    );
    console.log("PASS repeated cleanup does not subtract twice");

    cartDocuments = new Map([["product-a", 2]]);
    failCommit = true;
    await assert.rejects(
        vm.runInContext(
            "cleanupPurchasedAccountCart(" +
            "'customer-a', 'order-failed', " +
            "[{ id: 'product-a', quantity: 2 }])",
            context
        )
    );
    assert.deepEqual(
        Array.from(cartDocuments.entries()),
        [["product-a", 2]]
    );
    failCommit = false;
    console.log("PASS cleanup failure leaves cart unchanged");

    storage.set(
        "aloraCart",
        JSON.stringify([{ id: "product-a", quantity: 2 }])
    );
    await vm.runInContext(
        "buyNow('Product A', 100)",
        context
    );
    assert.deepEqual(
        JSON.parse(storage.get("aloraCart")),
        [{ id: "product-a", quantity: 2 }]
    );
    console.log("PASS Buy Now preserves cart");

    elements.get("customerName").value = "Customer";
    elements.get("phone").value = "9999999999";
    elements.get("address").value = "Address";
    elements.get("email").value = "customer@example.test";
    elements.get("productName").value = "Product A";
    elements.get("productPrice").value = "₹200";
    elements.get("totalPrice").value = "₹200";
    elements.get("payment").value = "Cash on Delivery";
    cartDocuments = new Map([["product-a", 2]]);
    orderSaveShouldFail = false;
    storage.set(
        "aloraCheckoutCart",
        JSON.stringify([
            { id: "product-a", name: "Product A", quantity: 2 }
        ])
    );
    context.window.location.href =
        "https://alora.example/order.html";
    await vm.runInContext(
        "loadOrderPage(); placeOrder()",
        context
    );
    assert.deepEqual(
        Array.from(cartDocuments.entries()),
        []
    );
    await vm.runInContext(
        "initializeAccountPersistence({ uid: 'customer-a' })",
        context
    );
    assert.deepEqual(
        vm.runInContext("getCart()", context),
        []
    );
    console.log(
        "PASS successful cart checkout stays cleared after reload"
    );

    orderSaveShouldFail = true;
    vm.runInContext(
        "placeOrderCompleted = false; placeOrderInFlight = false",
        context
    );
    elements.get("customerName").value = "Customer";
    elements.get("phone").value = "9999999999";
    elements.get("address").value = "Address";
    elements.get("email").value = "customer@example.test";
    elements.get("productName").value = "Product A";
    elements.get("productPrice").value = "₹200";
    elements.get("totalPrice").value = "₹200";
    elements.get("payment").value = "Cash on Delivery";
    storage.set(
        "aloraCheckoutCart",
        JSON.stringify([
            { id: "product-a", name: "Product A", quantity: 2 }
        ])
    );
    await vm.runInContext(
        "loadOrderPage(); placeOrder()",
        context
    );
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(savedOrder, true);
    assert.deepEqual(
        JSON.parse(storage.get("aloraCheckoutCart")),
        [{ id: "product-a", name: "Product A", quantity: 2 }]
    );
    assert.match(
        alerts.join(" "),
        /synthetic order save failure/i
    );
    console.log("PASS failed order save preserves checkout cart");

    vm.runInContext(
        "placeOrderCompleted = false; placeOrderInFlight = false",
        context
    );
    failCommit = true;
    orderSaveShouldFail = false;
    cartDocuments = new Map([["product-a", 2]]);
    storage.set(
        "aloraCheckoutCart",
        JSON.stringify([
            { id: "product-a", name: "Product A", quantity: 2 }
        ])
    );
    await vm.runInContext(
        "loadOrderPage(); placeOrder()",
        context
    );
    assert.match(
        alerts.join(" "),
        /order was placed successfully, but your cart could not be updated/i
    );
    assert.deepEqual(
        Array.from(cartDocuments.entries()),
        [["product-a", 2]]
    );
    console.log(
        "PASS cleanup failure does not turn saved order into failure"
    );
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
