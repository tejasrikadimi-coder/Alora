const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "admin.js"),
    "utf8"
);

function extractFunction(name) {
    const start = source.indexOf(`function ${name}`);
    const open = source.indexOf("{", start);
    let depth = 0;

    for (let index = open; index < source.length; index += 1) {
        if (source[index] === "{") {
            depth += 1;
        } else if (source[index] === "}") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(start, index + 1);
            }
        }
    }

    throw new Error(`Unable to extract ${name}`);
}

const messageElement = {
    textContent: "",
    className: ""
};
const cards = new Map();
let renderedOrders = null;
let scrolled = false;
let highlighted = false;

const context = vm.createContext({
    URLSearchParams,
    encodeURIComponent,
    window: {
        location: {
            search:
                "?orderId=ALR-12345678&userId=customer-1"
        }
    },
    adminDirectOrderMessage: messageElement,
    ordersByKey: new Map([
        [
            "customer-1__ALR-12345678",
            {
                key: "customer-1__ALR-12345678"
            }
        ]
    ]),
    allAdminOrders: [
        {
            key: "customer-1__ALR-12345678"
        }
    ],
    renderAdminOrders(orders) {
        renderedOrders = orders;
        const card = {
            classList: {
                add() {
                    highlighted = true;
                },
                remove() {
                    highlighted = false;
                }
            },
            scrollIntoView() {
                scrolled = true;
            }
        };
        cards.set(
            "admin-order-customer-1__ALR-12345678",
            card
        );
    },
    document: {
        getElementById(id) {
            return cards.get(id) || null;
        }
    },
    setTimeout() {}
});

vm.runInContext(
    extractFunction("getAdminOrderCardId") +
    extractFunction("showDirectOrderMessage") +
    extractFunction("openDirectOrderFromUrl"),
    context
);

vm.runInContext(
    "openDirectOrderFromUrl()",
    context
);
assert.equal(renderedOrders, context.allAdminOrders);
assert.equal(scrolled, true);
assert.equal(highlighted, true);
console.log("PASS valid direct order link renders and highlights exact order");

context.window.location.search =
    "?orderId=missing&userId=customer-1";
vm.runInContext(
    "openDirectOrderFromUrl()",
    context
);
assert.match(
    messageElement.textContent,
    /Order not found or you do not have access/
);
console.log("PASS invalid direct order link shows admin-friendly message");
