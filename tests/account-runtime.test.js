const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(
    path.resolve(__dirname, "..", "script.js"),
    "utf8"
);

const elements = new Map();
function element(id) {
    if (!elements.has(id)) {
        elements.set(id, {
            id,
            innerHTML: "",
            textContent: "",
            style: {},
            classList: {
                add() {},
                remove() {},
                toggle() {}
            },
            addEventListener() {},
            querySelectorAll() {
                return [];
            },
            appendChild(child) {
                this.innerHTML += child.innerHTML || "";
            }
        });
    }
    return elements.get(id);
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
    "cartCountBadge"
].forEach(element);

let domReady;
const document = {
    addEventListener(type, callback) {
        if (type === "DOMContentLoaded") {
            domReady = callback;
        }
    },
    getElementById(id) {
        return elements.get(id) || null;
    },
    querySelectorAll() {
        return [];
    },
    createElement(tagName) {
        return {
            tagName,
            className: "",
            innerHTML: "",
            appendChild() {},
            addEventListener() {}
        };
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

let currentUid = null;
let shouldFailReads = false;
let authCallback;
const products = {
    "product-a": {
        name: "Account A Product",
        price: 100,
        image: "a.jpg",
        stock: 4,
        active: true
    },
    "product-b": {
        name: "Account B Product",
        price: 200,
        image: "b.jpg",
        stock: 4,
        active: true
    }
};

function firestoreDoc(path) {
    return {
        id: path[path.length - 1],
        path
    };
}

function snapshot(docs) {
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
        return firestoreDoc(path);
    },
    getDocs(reference) {
        if (shouldFailReads && reference.path[0] === "users") {
            return Promise.reject(new Error("synthetic account read failure"));
        }

        if (reference.path[0] === "products") {
            return Promise.resolve(snapshot(
                Object.entries(products).map(([id, data]) => ({
                    id,
                    data: () => data
                }))
            ));
        }

        const collectionName = reference.path[2];
        const id = currentUid === "account-a"
            ? "product-a"
            : "product-b";

        if (collectionName === "wishlist") {
            return Promise.resolve(snapshot([{
                    id,
                    data: () => ({
                        productId: id,
                        createdAt: "2026-09-11T00:00:00.000Z"
                    })
                }]));
        }

        if (collectionName === "cart") {
            return Promise.resolve(snapshot([{
                    id,
                    data: () => ({
                        productId: id,
                        quantity: 1
                    })
                }]));
        }

        return Promise.resolve(snapshot([]));
    },
    writeBatch() {
        return {
            set() {},
            delete() {},
            commit() {
                return Promise.resolve();
            }
        };
    }
};

const firebase = {
    auth: {},
    db: {}
};

async function syntheticModule(moduleExports) {
    const module = new vm.SyntheticModule(
        Object.keys(moduleExports),
        function () {
            Object.entries(moduleExports).forEach(
                ([name, value]) => this.setExport(name, value)
            );
        }
    );
    await module.link(() => {
        throw new Error("Synthetic module has no imports");
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
            href: ""
        }
    },
    URLSearchParams,
    Promise,
    Map,
    Set,
    Number,
    String,
    Date,
    Math,
    JSON,
    alert() {},
    requestAnimationFrame(callback) {
        callback();
    },
    setTimeout,
    clearTimeout
});

(async function run() {
const vmScript = new vm.Script(script, {
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
                onAuthStateChanged(_auth, callback) {
                    authCallback = callback;
                }
            });
        }

        return Promise.reject(
            new Error(`Unexpected import: ${specifier}`)
        );
    }
});

vmScript.runInContext(context);
assert.equal(typeof domReady, "function");
domReady();
await new Promise(resolve => setImmediate(resolve));
assert.equal(typeof authCallback, "function");

currentUid = "account-a";
await authCallback({ uid: currentUid });
await new Promise(resolve => setImmediate(resolve));
assert.match(element("wishlistGrid").innerHTML, /Account A Product/);
assert.match(element("cartItems").innerHTML, /Account A Product/);
console.log("PASS authenticated wishlist/cart initialization");

currentUid = "account-b";
await authCallback({ uid: currentUid });
await new Promise(resolve => setImmediate(resolve));
assert.match(element("wishlistGrid").innerHTML, /Account B Product/);
assert.match(element("cartItems").innerHTML, /Account B Product/);
assert.doesNotMatch(element("cartItems").innerHTML, /Account A Product/);
console.log("PASS account switching removes previous account items");

shouldFailReads = true;
await authCallback({ uid: "account-failing" });
await new Promise(resolve => setImmediate(resolve));
assert.match(element("cartItems").innerHTML, /could not be synchronized|Unable to load/);
assert.equal(element("emptyCart").style.display, "none");
console.log("PASS account load failure shows an error instead of empty cart");
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
