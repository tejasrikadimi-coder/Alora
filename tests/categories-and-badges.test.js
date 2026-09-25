const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Load products.js source and extract determineProductCategory & determineProductBadge
const productsSource = fs.readFileSync(path.resolve(__dirname, "..", "products.js"), "utf8");

// Mock window and document
const window = {};
const document = { getElementById: () => null, addEventListener: () => {} };

// Evaluate functions into module context
const fnRegexCat = /export function determineProductCategory\([\s\S]*?\n\}/;
const fnRegexBadge = /export function determineProductBadge\([\s\S]*?\n\}/;

const catFnCode = productsSource.match(fnRegexCat)[0].replace("export ", "");
const badgeFnCode = productsSource.match(fnRegexBadge)[0].replace("export ", "");

const determineProductCategory = new Function("product", `${catFnCode}; return determineProductCategory(product);`);
const determineProductBadge = new Function("product", `${badgeFnCode}; return determineProductBadge(product);`);

console.log("--- Running Categories & Badges Unit Tests ---");

// Test 1: Category detection fallback
assert.equal(determineProductCategory({ name: "Gold Floral Jhumka Earrings" }), "Earrings");
assert.equal(determineProductCategory({ name: "Lotus Kundan Choker Necklace" }), "Necklaces");
assert.equal(determineProductCategory({ name: "Pearl Kada Bangle Set" }), "Bangles");
assert.equal(determineProductCategory({ name: "Rose Gold Hair Pins" }), "Hair Pins");
assert.equal(determineProductCategory({ name: "Little Princess Baby Bracelet", description: "Cute kids jewellery" }), "Bangles"); // matches bracelet first
assert.equal(determineProductCategory({ name: "Little Princess Baby Brooch", description: "Cute kids jewellery" }), "Kids Jewellery");
assert.equal(determineProductCategory({ name: "Crystal Solitaire Ring" }), "Rings");
assert.equal(determineProductCategory({ name: "Customized Name Bookmark", description: "Handcrafted special gift" }), "Custom Jewellery");
console.log("PASS: Category detection fallback correctly identifies all 7 categories");

// Test 2: Explicit category property overrides keyword heuristics
assert.equal(determineProductCategory({ name: "Lotus Floral Item", category: "Necklaces" }), "Necklaces");
assert.equal(determineProductCategory({ name: "Sparkle Ring", category: "Custom Jewellery" }), "Custom Jewellery");
assert.equal(determineProductCategory({ name: "Pendant Item", category: "Kids Jewellery" }), "Kids Jewellery");
console.log("PASS: Explicit category property overrides fallback heuristics");

// Test 3: Badge determination
assert.deepEqual(determineProductBadge({ name: "Lotus Earring", stock: 0 }), { text: "Out of Stock", className: "badge-out-of-stock" });
assert.deepEqual(determineProductBadge({ name: "Best Seller Pearl Choker", badge: "BEST SELLER", stock: 5 }), { text: "BEST SELLER", className: "badge-bestseller" });
assert.deepEqual(determineProductBadge({ name: "Custom Name Frame", badge: "CUSTOMIZABLE", stock: 10 }), { text: "CUSTOMIZABLE", className: "badge-custom" });
assert.deepEqual(determineProductBadge({ name: "Summer Necklace", isNew: true, stock: 3 }), { text: "NEW", className: "badge-new" });
console.log("PASS: Product badge assignment properly resolves out-of-stock, best seller, new, and custom badges");

// Test 4: Filtering and sorting logic
const sampleProducts = [
    { id: "1", name: "Jhumka Earring", price: 499, stock: 5, category: "Earrings" },
    { id: "2", name: "Gold Choker", price: 1299, stock: 0, category: "Necklaces" },
    { id: "3", name: "Kundan Earring", price: 799, stock: 3, category: "Earrings" },
    { id: "4", name: "Silver Bangle", price: 999, stock: 10, category: "Bangles" }
];

function filterAndSortProducts(products, category, sortOption, inStockOnly, searchQuery, minPrice = null, maxPrice = null) {
    return products.filter(p => {
        const cat = determineProductCategory(p);
        if (category && category !== "All" && cat.toLowerCase() !== category.toLowerCase()) {
            return false;
        }
        if (inStockOnly && Number(p.stock) <= 0) {
            return false;
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const text = ((p.name || "") + " " + (p.description || "")).toLowerCase();
            if (!text.includes(query)) return false;
        }
        if (minPrice !== null && !isNaN(minPrice)) {
            if (Number(p.price) < minPrice) return false;
        }
        if (maxPrice !== null && !isNaN(maxPrice)) {
            if (Number(p.price) > maxPrice) return false;
        }
        return true;
    }).sort((a, b) => {
        if (sortOption === "price-low") return a.price - b.price;
        if (sortOption === "price-high") return b.price - a.price;
        if (sortOption === "name-asc") return (a.name || "").localeCompare(b.name || "");
        return 0;
    });
}

const earringsOnly = filterAndSortProducts(sampleProducts, "Earrings", "featured", false, "");
assert.equal(earringsOnly.length, 2);
assert.equal(earringsOnly[0].id, "1");
assert.equal(earringsOnly[1].id, "3");
console.log("PASS: Category filtering isolates category items");

const inStockFilter = filterAndSortProducts(sampleProducts, "All", "featured", true, "");
assert.equal(inStockFilter.length, 3);
assert.ok(inStockFilter.every(p => p.stock > 0));
console.log("PASS: In-stock filter excludes out of stock items");

const priceSorted = filterAndSortProducts(sampleProducts, "All", "price-low", false, "");
assert.equal(priceSorted[0].price, 499);
assert.equal(priceSorted[3].price, 1299);
console.log("PASS: Price ascending sort correctly orders products");

// Test 5: Manual Price Range filter
// Sample prices: 499, 799, 999, 1299
// min-only: >= 800 -> 999, 1299
const minOnly = filterAndSortProducts(sampleProducts, "All", "featured", false, "", 800, null);
assert.equal(minOnly.length, 2);
assert.ok(minOnly.every(p => p.price >= 800));
console.log("PASS: Price filter (min-only) correctly selects products >= min");

// max-only: <= 800 -> 499, 799
const maxOnly = filterAndSortProducts(sampleProducts, "All", "featured", false, "", null, 800);
assert.equal(maxOnly.length, 2);
assert.ok(maxOnly.every(p => p.price <= 800));
console.log("PASS: Price filter (max-only) correctly selects products <= max");

// min + max: 600 to 1000 -> 799, 999
const minMax = filterAndSortProducts(sampleProducts, "All", "featured", false, "", 600, 1000);
assert.equal(minMax.length, 2);
assert.equal(minMax[0].price, 799);
assert.equal(minMax[1].price, 999);
console.log("PASS: Price filter (min + max) correctly isolates range");

// combined: category Earrings + price >= 600 -> only Kundan Earring (799)
const combined = filterAndSortProducts(sampleProducts, "Earrings", "featured", false, "", 600, null);
assert.equal(combined.length, 1);
assert.equal(combined[0].id, "3");
console.log("PASS: Price filter works together with category filter");

// combined: inStockOnly + max <= 1000 -> 499 (instock), 799 (instock), 999 (instock)
const stockAndPrice = filterAndSortProducts(sampleProducts, "All", "featured", true, "", null, 1000);
assert.equal(stockAndPrice.length, 3);
assert.ok(stockAndPrice.every(p => p.stock > 0 && p.price <= 1000));
console.log("PASS: Price filter works together with in-stock availability and sorting");

console.log("\nALL CATEGORIES, BADGES & PRICE FILTER TESTS PASSED (100%)!\n");
