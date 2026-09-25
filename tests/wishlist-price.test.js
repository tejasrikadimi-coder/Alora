const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs
    .readFileSync(
        path.resolve(__dirname, "..", "script.js"),
        "utf8"
    )
    .replace(/\bimport\(/g, "mockImport(");

const storage = new Map([
    [
        "aloraWishlist",
        JSON.stringify([
            {
                name: "Lotus Neckset",
                price: 799,
                image: "old-image.jpeg",
                quantity: 1,
                stock: 10
            }
        ])
    ]
]);
let _gridCards = [];
const grid = {
    get innerHTML() {
        return "";
    },
    set innerHTML(val) {
        if (val === "") {
            _gridCards = [];
        }
    },
    get cards() {
        return _gridCards;
    },
    appendChild(card) {
        _gridCards.push(card);
    }
};
const empty = { style: { display: "" } };
const document = {
    getElementById(id) {
        if (id === "wishlistGrid") return grid;
        if (id === "emptyWishlist") return empty;
        return null;
    },
    querySelectorAll() {
        return [];
    },
    createElement() {
        return {
            className: "",
            innerHTML: ""
        };
    },
    addEventListener(event, handler) {
        if (event === "DOMContentLoaded") {
            setTimeout(handler, 0);
        }
    }
};
const context = {
    console,
    document,
    localStorage: {
        getItem: key => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value)
    },
    window: {
        location: { search: "" }
    },
    URLSearchParams,
    Number,
    String,
    JSON,
    Math,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
    mockImport: async moduleName => {
        if (moduleName === "./firebase.js") {
            return { db: "mock-db", auth: {} };
        }
        if (moduleName.includes("firebase-auth")) {
            return {
                onAuthStateChanged: (_auth, callback) => {
                    callback(null);
                }
            };
        }
        return {
            collection: (db, name) => ({ db, name }),
            getDocs: async () => ({
                docs: [
                    {
                        id: "lotus-id",
                        data: () => ({
                            name: "Lotus Neckset",
                            price: 1299,
                            image: "current-image.jpeg",
                            stock: 7,
                            active: true
                        })
                    }
                ]
            })
        };
    }
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context);

async function main() {
    await new Promise(resolve => setTimeout(resolve, 50));
    await context.renderWishlist();
    assert.equal(grid.cards.length, 1);
    assert.match(grid.cards[0].innerHTML, /₹1299/);
    assert.doesNotMatch(grid.cards[0].innerHTML, /₹799/);
    assert.match(grid.cards[0].innerHTML, /buyNow\([^)]*1299/);
    assert.match(grid.cards[0].innerHTML, /addToCart\([^)]*1299/);
    assert.match(grid.cards[0].innerHTML, /current-image\.jpeg/);
    console.log("PASS stale wishlist price replaced by Firestore price");
    console.log("PASS wishlist Buy Now and Add to Cart use Firestore price");
}

main().catch(error => {
    console.error("FAIL wishlist price test:", error.message);
    process.exitCode = 1;
});
