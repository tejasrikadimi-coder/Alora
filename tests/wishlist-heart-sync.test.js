const fs = require("fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const scriptSource = fs.readFileSync(
    path.resolve(__dirname, "..", "script.js"),
    "utf8"
).replace(/\bimport\(/g, "mockImport(");

const storage = new Map();

function createMockElement(tag, className = "") {
    return {
        tagName: tag.toUpperCase(),
        className: className,
        classList: {
            classes: new Set(className ? className.split(" ") : []),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            toggle(c, force) {
                if (force !== undefined) {
                    if (force) this.classes.add(c); else this.classes.delete(c);
                } else {
                    if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c);
                }
            },
            contains(c) { return this.classes.has(c); }
        },
        dataset: {},
        textContent: "",
        title: "",
        attributes: new Map(),
        setAttribute(k, v) { this.attributes.set(k, v); },
        getAttribute(k) { return this.attributes.get(k); },
        innerHTML: "",
        style: {},
        appendChild(c) {}
    };
}

const buttons = [
    createMockElement("button", "wishlist-btn"),
    createMockElement("button", "wishlist-btn")
];
buttons[0].dataset.name = "Lotus Neckset";
buttons[0].dataset.id = "prod-101";
buttons[1].dataset.name = "Hair Pins";
buttons[1].dataset.id = "prod-102";

const context = {
    console,
    document: {
        getElementById(id) {
            if (id === "productWishlistBtn") return createMockElement("button", "product-wishlist-btn");
            return null;
        },
        querySelectorAll(selector) {
            if (selector === ".wishlist-btn") return buttons;
            return [];
        },
        createElement(tag) { return createMockElement(tag); },
        addEventListener() {}
    },
    window: {
        location: { search: "", pathname: "/index.html", href: "http://localhost:3000/index.html" },
        addEventListener() {}
    },
    localStorage: {
        getItem: k => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: k => storage.delete(k)
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
    mockImport: async () => ({})
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(scriptSource, context);

// Test 1: Initially no items in wishlist, updateWishlistButtons sets all to outline ♡
context.updateWishlistButtons();
assert.equal(buttons[0].textContent, "♡");
assert.equal(buttons[0].classList.contains("active"), false);
assert.equal(buttons[1].textContent, "♡");
assert.equal(buttons[1].classList.contains("active"), false);
console.log("PASS Test 1: Initial state is outline ♡ and inactive");

// Test 2: Toggle add Lotus Neckset
context.toggleWishlist("Lotus Neckset", 999, "lotus.jpg", buttons[0], 10, "prod-101");
assert.equal(buttons[0].textContent, "♥");
assert.equal(buttons[0].classList.contains("active"), true);
const savedList = JSON.parse(storage.get("aloraWishlist"));
assert.equal(savedList.length, 1);
assert.equal(savedList[0].id, "prod-101");
assert.equal(savedList[0].name, "Lotus Neckset");
console.log("PASS Test 2: toggleWishlist immediately turns button into filled ♥ and active");

// Test 3: updateWishlistButtons preserves active state for prod-101
buttons[0].textContent = "♡";
buttons[0].classList.remove("active");
context.updateWishlistButtons();
assert.equal(buttons[0].textContent, "♥");
assert.equal(buttons[0].classList.contains("active"), true);
assert.equal(buttons[1].textContent, "♡");
console.log("PASS Test 3: updateWishlistButtons correctly restores filled ♥ for wishlisted products");

// Test 4: Toggle remove Lotus Neckset
context.toggleWishlist("Lotus Neckset", 999, "lotus.jpg", buttons[0], 10, "prod-101");
assert.equal(buttons[0].textContent, "♡");
assert.equal(buttons[0].classList.contains("active"), false);
const emptyList = JSON.parse(storage.get("aloraWishlist"));
assert.equal(emptyList.length, 0);
console.log("PASS Test 4: Second toggle immediately reverts button to outline ♡ and removes from storage");

// Test 5: Duplicate prevention & matching
storage.set("aloraWishlist", JSON.stringify([
    { id: "prod-101", name: "Lotus Neckset", price: 999 },
    { id: "", name: "lotus neckset", price: 999 }
]));
assert.equal(context.isProductInWishlist("Lotus Neckset", "prod-101"), true);
context.removeFromWishlist("Lotus Neckset", "prod-101");
const cleanedList = JSON.parse(storage.get("aloraWishlist"));
assert.equal(cleanedList.length, 0);
console.log("PASS Test 5: Duplicate variants safely matched and cleaned");

console.log("\nALL UNIT TESTS IN wishlist-heart-sync.test.js PASSED (100%)!");
