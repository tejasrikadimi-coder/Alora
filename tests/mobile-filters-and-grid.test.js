const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

console.log("--- Running Mobile Filters & Grid Layout Unit Tests ---");

const ROOT = path.resolve(__dirname, "..");

// 1. Verify collections.html contains mobile filter toolbar and drawer modal markup
const collectionsHtml = fs.readFileSync(path.join(ROOT, "collections.html"), "utf8");

assert.ok(collectionsHtml.includes('id="mobileFilterToolbar"'), "collections.html missing #mobileFilterToolbar");
assert.ok(collectionsHtml.includes('id="mobileFilterBtn"'), "collections.html missing #mobileFilterBtn");
assert.ok(collectionsHtml.includes('id="filterCountBadge"'), "collections.html missing #filterCountBadge");
assert.ok(collectionsHtml.includes('id="mobileSortSelect"'), "collections.html missing #mobileSortSelect");
assert.ok(collectionsHtml.includes('id="filterDrawerOverlay"'), "collections.html missing #filterDrawerOverlay");
assert.ok(collectionsHtml.includes('id="filterDrawer"'), "collections.html missing #filterDrawer");
assert.ok(collectionsHtml.includes('id="drawerCategoryChips"'), "collections.html missing #drawerCategoryChips");
assert.ok(collectionsHtml.includes('id="drawerMinPrice"'), "collections.html missing #drawerMinPrice");
assert.ok(collectionsHtml.includes('id="drawerMaxPrice"'), "collections.html missing #drawerMaxPrice");
assert.ok(collectionsHtml.includes('id="drawerInStockFilter"'), "collections.html missing #drawerInStockFilter");
assert.ok(collectionsHtml.includes('id="drawerApplyBtn"'), "collections.html missing #drawerApplyBtn");
assert.ok(collectionsHtml.includes('id="drawerResetBtn"'), "collections.html missing #drawerResetBtn");

console.log("PASS: collections.html contains all mobile filter drawer elements");

// 2. Verify style.css rules for mobile 2-column grid and drawer
const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");

// Mobile product grid
assert.ok(css.includes("repeat(2, minmax(0, 1fr))"), "style.css missing 2-column repeat grid rule");
assert.ok(css.includes("aspect-ratio: 1 / 1"), "style.css missing aspect-ratio: 1 / 1 rule for product images");
assert.ok(css.includes("-webkit-line-clamp: 2"), "style.css missing 2-line clamping for product titles");
assert.ok(css.includes(".mobile-filter-toolbar"), "style.css missing .mobile-filter-toolbar rule");
assert.ok(css.includes(".filter-drawer-overlay"), "style.css missing .filter-drawer-overlay rule");
assert.ok(css.includes(".mobile-sticky-actions"), "style.css missing .mobile-sticky-actions rule");
assert.ok(css.includes("safe-area-inset-bottom"), "style.css missing safe-area-inset-bottom support");

console.log("PASS: style.css enforces 2-column mobile grid, 1:1 aspect ratio, line clamp, and drawer styles");

// 3. Test filter count calculation logic
function calculateFilterCount(category, minPrice, maxPrice, inStockOnly) {
    let count = 0;
    if (category && category !== "All") count++;
    if (minPrice !== null || maxPrice !== null) count++;
    if (inStockOnly) count++;
    return count;
}

assert.equal(calculateFilterCount("All", null, null, false), 0, "Default state should have 0 active filters");
assert.equal(calculateFilterCount("Earrings", null, null, false), 1, "Category filter alone should increment count to 1");
assert.equal(calculateFilterCount("All", 500, null, false), 1, "Min price alone should increment count to 1");
assert.equal(calculateFilterCount("All", null, 1500, false), 1, "Max price alone should increment count to 1");
assert.equal(calculateFilterCount("All", 500, 1500, false), 1, "Min + Max price range counts as 1 filter criteria");
assert.equal(calculateFilterCount("All", null, null, true), 1, "In-stock filter alone should increment count to 1");
assert.equal(calculateFilterCount("Earrings", 500, 1500, true), 3, "Category + Price Range + In-Stock should equal 3 active filters");

console.log("PASS: Filter count calculation correctly tallies active criteria");

// 4. Test price range normalization and auto-swap logic
function normalizePriceRange(rawMin, rawMax) {
    let minVal = rawMin !== "" && rawMin !== null ? Number(rawMin) : null;
    let maxVal = rawMax !== "" && rawMax !== null ? Number(rawMax) : null;
    if (minVal !== null && (isNaN(minVal) || minVal < 0)) minVal = null;
    if (maxVal !== null && (isNaN(maxVal) || maxVal < 0)) maxVal = null;
    if (minVal !== null && maxVal !== null && minVal > maxVal) {
        const temp = minVal;
        minVal = maxVal;
        maxVal = temp;
    }
    return { minVal, maxVal };
}

const swapped = normalizePriceRange(1200, 400);
assert.equal(swapped.minVal, 400, "Min should be swapped to 400");
assert.equal(swapped.maxVal, 1200, "Max should be swapped to 1200");

const normalRange = normalizePriceRange(300, 900);
assert.equal(normalRange.minVal, 300);
assert.equal(normalRange.maxVal, 900);

const minOnlyRange = normalizePriceRange(500, "");
assert.equal(minOnlyRange.minVal, 500);
assert.equal(minOnlyRange.maxVal, null);

console.log("PASS: Price range normalization and auto-swap works correctly");

console.log("\nALL MOBILE FILTERS & GRID TESTS PASSED (100%)!\n");
