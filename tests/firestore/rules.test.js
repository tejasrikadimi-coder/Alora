const assert = require("node:assert/strict");
const {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails
} = require("@firebase/rules-unit-testing");
const {
    collection,
    collectionGroup,
    addDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    serverTimestamp
} = require("firebase/firestore");

const projectId = "demo-alora-rules";
const customerUid = "customer-1";
const otherUid = "customer-2";
const adminUid = "admin-1";
const orderId = "order-1";
const deliveredOrderId = "order-delivered";

const validOrder = userId => ({
    id: orderId,
    products: "Lotus Neckset",
    quantity: 1,
    items: [{ name: "Lotus Neckset", quantity: 1 }],
    total: "₹999",
    payment: "Cash on Delivery",
    customer: "Synthetic Customer",
    phone: "9999999999",
    email: "customer@example.test",
    address: "Synthetic Address",
    date: "10 Sep 2026, 07:00 pm",
    status: "Order Received",
    estimatedDeliveryStart: "2026-09-17T00:00:00.000Z",
    estimatedDeliveryEnd: "2026-09-20T00:00:00.000Z",
    userId,
    stockDeducted: false,
    stockRestored: false,
    paymentStatus: "Pending",
    utr: "",
    cancelRequest: null,
    returnRequest: null,
    exchangeRequest: null,
    createdAt: "2026-09-10T13:30:00.000Z",
    updatedAt: "2026-09-10T13:30:00.000Z"
});

async function main() {
    const testEnv = await initializeTestEnvironment({
        projectId,
        firestore: {
            host: "127.0.0.1",
            port: 8080,
            rules: require("fs").readFileSync(
                require("path").resolve(
                    __dirname,
                    "../../firestore.rules"
                ),
                "utf8"
            )
        }
    });
    const seedDb = testEnv
        .authenticatedContext("seed")
        .firestore();
    await testEnv.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        const pathsToClear = [
            ["products", "product-1"],
            ["users", adminUid],
            ["users", otherUid],
            ["users", customerUid],
            [
                "users",
                customerUid,
                "orders",
                orderId
            ],
            [
                "users",
                customerUid,
                "orders",
                "online-payment-order"
            ],
            [
                "users",
                customerUid,
                "orders",
                "paid-online-order"
            ],
            [
                "users",
                customerUid,
                "orders",
                deliveredOrderId
            ],
            [
                "users",
                customerUid,
                "orders",
                orderId,
                "requests",
                "cancel"
            ],
            [
                "users",
                customerUid,
                "orders",
                deliveredOrderId,
                "requests",
                "return"
            ],
            [
                "users",
                customerUid,
                "orders",
                deliveredOrderId,
                "requests",
                "exchange"
            ],
            [
                "users",
                customerUid,
                "wishlist",
                "product-1"
            ],
            [
                "users",
                customerUid,
                "cart",
                "product-1"
            ]
        ];

        for (const path of pathsToClear) {
            await deleteDoc(doc(db, ...path));
        }

        await setDoc(doc(db, "products", "product-1"), {
            name: "Lotus Neckset",
            stock: 10
        });
        await setDoc(doc(db, "users", adminUid), {
            name: "Synthetic Admin",
            email: "admin@example.test",
            role: "admin"
        });
        await setDoc(doc(db, "users", otherUid), {
            name: "Other Customer",
            email: "other@example.test"
        });
        await setDoc(
            doc(
                db,
                "users",
                customerUid,
                "orders",
                deliveredOrderId
            ),
            {
                ...validOrder(customerUid),
                id: deliveredOrderId,
                status: "Delivered",
                deliveredAt: "2026-09-08T00:00:00.000Z"
            }
        );
    });
    void seedDb;

    const anon = testEnv.unauthenticatedContext().firestore();
    const customer = testEnv
        .authenticatedContext(customerUid)
        .firestore();
    const other = testEnv
        .authenticatedContext(otherUid)
        .firestore();
    const admin = testEnv
        .authenticatedContext(adminUid)
        .firestore();

    const checks = [];
    async function check(name, operation, expected) {
        try {
            if (expected === "allow") {
                await assertSucceeds(operation());
            } else {
                await assertFails(operation());
            }
            checks.push(`PASS ${name}`);
        } catch (error) {
            checks.push(`FAIL ${name}: ${error.message}`);
            throw error;
        }
    }

    await check(
        "anonymous reads products",
        () => getDoc(doc(anon, "products", "product-1")),
        "allow"
    );
    await check(
        "anonymous cannot write products",
        () =>
            updateDoc(doc(anon, "products", "product-1"), {
                stock: 99
            }),
        "deny"
    );
    await check(
        "anonymous cannot read private profile",
        () => getDoc(doc(anon, "users", customerUid)),
        "deny"
    );
    await check(
        "anonymous cannot read private order",
        () =>
            getDoc(
                doc(
                    anon,
                    "users",
                    customerUid,
                    "orders",
                    deliveredOrderId
                )
            ),
        "deny"
    );

    await check(
        "customer creates profile without role",
        () =>
            setDoc(doc(customer, "users", customerUid), {
                name: "Synthetic Customer",
                email: "customer@example.test"
            }),
        "allow"
    );
    await check(
        "customer cannot create admin role",
        () =>
            setDoc(doc(customer, "users", "new-admin"), {
                name: "Forged Admin",
                email: "forged@example.test",
                role: "admin"
            }),
        "deny"
    );
    await check(
        "customer cannot add role",
        () =>
            updateDoc(doc(customer, "users", customerUid), {
                role: "admin"
            }),
        "deny"
    );
    await check(
        "customer can update allowed profile field",
        () =>
            updateDoc(doc(customer, "users", customerUid), {
                name: "Updated Customer"
            }),
        "allow"
    );
    await check(
        "customer cannot access another profile",
        () => getDoc(doc(customer, "users", otherUid)),
        "deny"
    );
    await check(
        "customer creates own wishlist item",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "wishlist",
                    "product-1"
                ),
                {
                    productId: "product-1",
                    createdAt: "2026-09-10T13:25:00.000Z"
                }
            ),
        "allow"
    );
    await check(
        "customer creates own cart item",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "cart",
                    "product-1"
                ),
                {
                    productId: "product-1",
                    quantity: 2,
                    updatedAt: "2026-09-10T13:26:00.000Z"
                }
            ),
        "allow"
    );
    await check(
        "anonymous cannot read wishlist",
        () =>
            getDoc(
                doc(
                    anon,
                    "users",
                    customerUid,
                    "wishlist",
                    "product-1"
                )
            ),
        "deny"
    );
    await check(
        "other customer cannot read wishlist",
        () =>
            getDoc(
                doc(
                    other,
                    "users",
                    customerUid,
                    "wishlist",
                    "product-1"
                )
            ),
        "deny"
    );
    await check(
        "other customer cannot write cart",
        () =>
            setDoc(
                doc(
                    other,
                    "users",
                    customerUid,
                    "cart",
                    "product-1"
                ),
                {
                    productId: "product-1",
                    quantity: 3,
                    updatedAt: "2026-09-10T13:27:00.000Z"
                }
            ),
        "deny"
    );
    await check(
        "invalid cart quantity rejected",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "cart",
                    "product-2"
                ),
                {
                    productId: "product-2",
                    quantity: 0,
                    updatedAt: "2026-09-10T13:28:00.000Z"
                }
            ),
        "deny"
    );
    await check(
        "admin cannot read customer wishlist",
        () =>
            getDoc(
                doc(
                    admin,
                    "users",
                    customerUid,
                    "wishlist",
                    "product-1"
                )
            ),
        "deny"
    );

    await check(
        "customer creates valid checkout order",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    orderId
                ),
                validOrder(customerUid)
            ),
        "allow"
    );
    await check(
        "customer creates valid online payment order with UTR",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    "online-payment-order"
                ),
                {
                    ...validOrder(customerUid),
                    id: "online-payment-order",
                    payment: "Online Payment (UPI)",
                    paymentStatus:
                        "Payment Verification Pending",
                    utr: "UTR-123456789"
                }
            ),
        "allow"
    );
    await check(
        "customer cannot create paid online payment order",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    "paid-online-order"
                ),
                {
                    ...validOrder(customerUid),
                    id: "paid-online-order",
                    payment: "Online Payment (UPI)",
                    paymentStatus: "Paid",
                    utr: "UTR-123456789"
                }
            ),
        "deny"
    );
    await check(
        "forged userId rejected",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    "forged-user"
                ),
                {
                    ...validOrder(customerUid),
                    id: "forged-user",
                    userId: otherUid
                }
            ),
        "deny"
    );
    await check(
        "forged initial status rejected",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    "forged-status"
                ),
                {
                    ...validOrder(customerUid),
                    id: "forged-status",
                    status: "Confirmed"
                }
            ),
        "deny"
    );
    await check(
        "forged payment status rejected",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    "forged-payment"
                ),
                {
                    ...validOrder(customerUid),
                    id: "forged-payment",
                    paymentStatus: "Paid"
                }
            ),
        "deny"
    );
    await check(
        "forged stock flags rejected",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    "forged-stock"
                ),
                {
                    ...validOrder(customerUid),
                    id: "forged-stock",
                    stockDeducted: true
                }
            ),
        "deny"
    );
    await check(
        "customer cannot update order",
        () =>
            updateDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    orderId
                ),
                { status: "Confirmed" }
            ),
        "deny"
    );
    await check(
        "customer cannot delete order",
        () =>
            deleteDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    orderId
                )
            ),
        "deny"
    );
    await check(
        "customer cannot change product stock",
        () =>
            updateDoc(doc(customer, "products", "product-1"), {
                stock: 9
            }),
        "deny"
    );
    await check(
        "customer cannot read another order",
        () =>
            getDoc(
                doc(
                    customer,
                    "users",
                    otherUid,
                    "orders",
                    "other-order"
                )
            ),
        "deny"
    );

    await check(
        "valid cancellation request succeeds",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    orderId,
                    "requests",
                    "cancel"
                ),
                {
                    type: "cancel",
                    reason: "Synthetic reason",
                    status: "Requested",
                    requestedAt: "2026-09-10T13:35:00.000Z"
                }
            ),
        "allow"
    );
    await check(
        "cancellation request overwrite rejected",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    orderId,
                    "requests",
                    "cancel"
                ),
                {
                    type: "cancel",
                    reason: "Overwrite",
                    status: "Requested",
                    requestedAt: "2026-09-10T13:36:00.000Z"
                }
            ),
        "deny"
    );
    await check(
        "ineligible cancellation rejected",
        () =>
            setDoc(
                doc(
                    customer,
                    "users",
                    customerUid,
                    "orders",
                    deliveredOrderId,
                    "requests",
                    "cancel"
                ),
                {
                    type: "cancel",
                    reason: "Too late",
                    status: "Requested",
                    requestedAt: "2026-09-10T13:37:00.000Z"
                }
            ),
        "deny"
    );
    for (const type of ["return", "exchange"]) {
        await check(
            `valid delivered ${type} request succeeds`,
            () =>
                setDoc(
                    doc(
                        customer,
                        "users",
                        customerUid,
                        "orders",
                        deliveredOrderId,
                        "requests",
                        type
                    ),
                    {
                        type,
                        reason: `Synthetic ${type}`,
                        status: "Requested",
                        requestedAt: "2026-09-10T13:38:00.000Z"
                    }
                ),
            "allow"
        );
    }

    await check(
        "admin collection group order query succeeds",
        () => getDocs(collectionGroup(admin, "orders")),
        "allow"
    );
    await check(
        "admin updates product stock",
        () =>
            updateDoc(doc(admin, "products", "product-1"), {
                stock: 12
            }),
        "allow"
    );
    await check(
        "admin updates order",
        () =>
            updateDoc(
                doc(
                    admin,
                    "users",
                    customerUid,
                    "orders",
                    orderId
                ),
                {
                    status: "Confirmed",
                    updatedAt: "2026-09-10T13:40:00.000Z"
                }
            ),
        "allow"
    );
    await check(
        "admin updates request",
        () =>
            updateDoc(
                doc(
                    admin,
                    "users",
                    customerUid,
                    "orders",
                    orderId,
                    "requests",
                    "cancel"
                ),
                {
                    status: "Approved",
                    reviewedAt: "2026-09-10T13:41:00.000Z"
                }
            ),
        "allow"
    );

    const validMessage = {
        userId: customerUid,
        name: "Synthetic Customer",
        email: "customer@example.test",
        subject: "Question",
        message: "Can you help with a custom order?",
        status: "New",
        createdAt: serverTimestamp()
    };
    const messageReference =
        await assertSucceeds(
            addDoc(
                collection(
                    customer,
                    "contactMessages"
                ),
                validMessage
            )
        );
    checks.push("PASS customer creates valid contact message");

    await check(
        "customer cannot spoof contact message owner",
        () =>
            addDoc(
                collection(
                    customer,
                    "contactMessages"
                ),
                {
                    ...validMessage,
                    userId: otherUid,
                    createdAt: serverTimestamp()
                }
            ),
        "deny"
    );
    await check(
        "anonymous cannot create contact message",
        () =>
            addDoc(
                collection(
                    anon,
                    "contactMessages"
                ),
                {
                    ...validMessage,
                    createdAt: serverTimestamp()
                }
            ),
        "deny"
    );
    await check(
        "customer cannot read contact messages",
        () =>
            getDoc(
                doc(
                    customer,
                    "contactMessages",
                    messageReference.id
                )
            ),
        "deny"
    );
    await check(
        "other customer cannot update contact message",
        () =>
            updateDoc(
                doc(
                    other,
                    "contactMessages",
                    messageReference.id
                ),
                {
                    status: "Read"
                }
            ),
        "deny"
    );
    await check(
        "admin reads contact messages",
        () =>
            getDoc(
                doc(
                    admin,
                    "contactMessages",
                    messageReference.id
                )
            ),
        "allow"
    );
    await check(
        "admin lists contact messages",
        () =>
            getDocs(
                collection(
                    admin,
                    "contactMessages"
                )
            ),
        "allow"
    );
    await check(
        "admin marks contact message read",
        () =>
            updateDoc(
                doc(
                    admin,
                    "contactMessages",
                    messageReference.id
                ),
                {
                    status: "Read"
                }
            ),
        "allow"
    );
    await check(
        "admin cannot change contact message fields",
        () =>
            updateDoc(
                doc(
                    admin,
                    "contactMessages",
                    messageReference.id
                ),
                {
                    subject: "Changed"
                }
            ),
        "deny"
    );
    await check(
        "customer cannot create invalid contact message",
        () =>
            addDoc(
                collection(
                    customer,
                    "contactMessages"
                ),
                {
                    ...validMessage,
                    message: "x".repeat(2001),
                    createdAt: serverTimestamp()
                }
            ),
        "deny"
    );

    console.log(checks.join("\n"));
    await testEnv.cleanup();
}

main().catch(error => {
    console.error("RULES TEST FAILED:", error.message);
    process.exitCode = 1;
});
