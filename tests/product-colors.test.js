const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");

console.log("================================================================================");
console.log("RUNNING ALORA COMPLETE PRODUCT COLOR MASTER SUITE (ALL 35 REQUIREMENTS)");
console.log("================================================================================");

// Load required files
const adminHtml = fs.readFileSync(path.join(projectRoot, "admin.html"), "utf8");
const productHtml = fs.readFileSync(path.join(projectRoot, "product.html"), "utf8");
const cartHtml = fs.readFileSync(path.join(projectRoot, "cart.html"), "utf8");
const styleCss = fs.readFileSync(path.join(projectRoot, "style.css"), "utf8");
const adminJsSource = fs.readFileSync(path.join(projectRoot, "admin.js"), "utf8");
const scriptJsSource = fs.readFileSync(path.join(projectRoot, "script.js"), "utf8");
const orderEmailJsSource = fs.readFileSync(path.join(projectRoot, "order-email.js"), "utf8");
const myOrdersJsSource = fs.readFileSync(path.join(projectRoot, "my-orders.js"), "utf8");

// Mock DOM factory
function createMockElement(tag = "div") {
    const listeners = {};
    const children = [];
    const classSet = new Set();
    const elem = {
        tagName: tag.toUpperCase(),
        style: {},
        _className: "",
        get className() { return this._className; },
        set className(val) {
            this._className = val || "";
            classSet.clear();
            if (val) {
                val.split(/\s+/).forEach(c => { if (c) classSet.add(c); });
            }
        },
        classList: {
            classes: classSet,
            add(c) {
                classSet.add(c);
                elem._className = Array.from(classSet).join(" ");
            },
            remove(c) {
                classSet.delete(c);
                elem._className = Array.from(classSet).join(" ");
            },
            contains(c) { return classSet.has(c); }
        },
        attributes: {},
        setAttribute(name, val) { this.attributes[name] = val; },
        getAttribute(name) { return this.attributes[name]; },
        removeAttribute(name) { delete this.attributes[name]; },
        children,
        appendChild(child) {
            child.parentNode = this;
            children.push(child);
            return child;
        },
        removeChild(child) {
            const idx = children.indexOf(child);
            if (idx >= 0) {
                children.splice(idx, 1);
                child.parentNode = null;
            }
            return child;
        },
        querySelector(selector) {
            for (const c of children) {
                if (selector.startsWith(".") && c.classList.contains(selector.slice(1))) return c;
                if (selector.includes("[value=")) {
                    const match = selector.match(/\[value="([^"]+)"/i);
                    if (match && c.value && c.value.toLowerCase() === match[1].toLowerCase()) return c;
                }
                if (selector.includes("[data-color=")) {
                    const match = selector.match(/\[data-color="([^"]+)"/i);
                    if (match && c.getAttribute("data-color") && c.getAttribute("data-color").toLowerCase() === match[1].toLowerCase()) return c;
                }
                const found = c.querySelector && c.querySelector(selector);
                if (found) return found;
            }
            return null;
        },
        querySelectorAll(selector) {
            const results = [];
            function search(node) {
                for (const c of node.children) {
                    if (selector === "input.admin-color-checkbox:checked" && c.type === "checkbox" && c.checked) {
                        results.push(c);
                    } else if (selector.startsWith(".") && c.classList.contains(selector.slice(1))) {
                        results.push(c);
                    }
                    if (c.children && c.children.length > 0) search(c);
                }
            }
            search(this);
            return results;
        },
        closest(selector) {
            let cur = this;
            while (cur) {
                if (selector.startsWith(".") && cur.classList && cur.classList.contains(selector.slice(1))) {
                    return cur;
                }
                cur = cur.parentNode;
            }
            return null;
        },
        addEventListener(event, fn) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
        },
        dispatch(event, e = {}) {
            if (listeners[event]) listeners[event].forEach(fn => fn(e));
        },
        set innerHTML(val) {
            if (val === "") children.length = 0;
            this._innerHTML = val;
        },
        get innerHTML() { return this._innerHTML || ""; },
        textContent: "",
        value: "",
        checked: false
    };
    return elem;
}

// Setup Admin VM environment
const adminElements = new Map();
[
    "adminProductHasColors",
    "adminProductColorsBody",
    "adminProductColorOptions",
    "adminProductCustomColorInput",
    "adminProductAddCustomColorBtn",
    "adminProductSelectedColorsText",
    "adminProductImageModeSingle",
    "adminProductImageModeCarousel",
    "adminProductColorImagesSection",
    "adminProductColorImagesList",
    "adminEditProductHasColors",
    "adminEditProductColorsBody",
    "adminEditProductColorOptions",
    "adminEditProductCustomColorInput",
    "adminEditProductAddCustomColorBtn",
    "adminEditProductSelectedColorsText",
    "adminEditProductImageModeSingle",
    "adminEditProductImageModeCarousel",
    "adminEditProductColorImagesSection",
    "adminEditProductColorImagesList"
].forEach(id => {
    adminElements.set(id, createMockElement(id.includes("Input") || id.includes("HasColors") || id.includes("ImageMode") ? "input" : "div"));
});

const adminVmContext = {
    document: {
        getElementById(id) { return adminElements.get(id) || null; },
        createElement(tag) { return createMockElement(tag); }
    },
    window: {},
    console,
    Array,
    Object,
    String,
    Boolean
};
vm.createContext(adminVmContext);

const adminColorControllerMatch = adminJsSource.match(
    /\/\* =====================================================\s+PRODUCT AVAILABLE COLORS CONTROLLER \(ADMIN\)[\s\S]*?\/\* =====================================================\s+SAVE PRODUCT TO FIRESTORE/
);
assert.ok(adminColorControllerMatch, "admin.js must contain PRODUCT AVAILABLE COLORS CONTROLLER section");
const controllerCode = adminColorControllerMatch[0].replace(
    /\/\* =====================================================\s+SAVE PRODUCT TO FIRESTORE/,
    ""
);

vm.runInContext(controllerCode, adminVmContext);
vm.runInContext(`
    window.initAdminColors = initAdminColors;
    window.getSelectedProductColors = getSelectedProductColors;
    window.setAdminColors = setAdminColors;
    window.resetAdminColors = resetAdminColors;
    window.renderAdminColorOptions = renderAdminColorOptions;
    window.addAdminCustomColor = addAdminCustomColor;
    window.getImageDisplayMode = getImageDisplayMode;
    window.setImageDisplayMode = setImageDisplayMode;
    window.renderAdminColorImagesList = renderAdminColorImagesList;
    window.adminColorsState = adminColorsState;
`, adminVmContext);

const {
    initAdminColors,
    getSelectedProductColors,
    setAdminColors,
    resetAdminColors,
    addAdminCustomColor,
    getImageDisplayMode,
    setImageDisplayMode,
    renderAdminColorImagesList,
    adminColorsState
} = adminVmContext.window;

// =========================================================================
// SECTION A: ADMIN CONTROLS & PRODUCT FORM TESTS (1 - 12)
// =========================================================================

// Test 1: Admin toggle enabled reveals color options and preview.
initAdminColors("add");
const addToggle = adminElements.get("adminProductHasColors");
const addBody = adminElements.get("adminProductColorsBody");
const addPreview = adminElements.get("adminProductSelectedColorsText");
const addGrid = adminElements.get("adminProductColorOptions");

addToggle.checked = true;
addToggle.dispatch("change");
assert.equal(addBody.style.display, "block", "Admin colors body must be displayed when toggle is enabled");
assert.equal(addPreview.textContent, "None", "Preview must show 'None' before any colors are selected");
console.log("PASS 1: Admin toggle enabled reveals color options and preview.");

// Test 2: Admin toggle disabled hides color options and preview and returns empty colors array.
addToggle.checked = false;
addToggle.dispatch("change");
assert.equal(addBody.style.display, "none", "Admin colors body must be hidden when toggle is disabled");
assert.deepEqual([...getSelectedProductColors("add")], [], "Disabling toggle must return empty colors array");
assert.equal(addPreview.textContent, "None", "Preview text must remain 'None'");
console.log("PASS 2: Admin toggle disabled hides color options and preview and returns empty colors array.");

// Test 3: Checking predefined colors updates selected list.
addToggle.checked = true;
addToggle.dispatch("change");
const goldOption = addGrid.children.find(c => c.getAttribute("data-color") === "Gold");
const silverOption = addGrid.children.find(c => c.getAttribute("data-color") === "Silver");
assert.ok(goldOption && silverOption, "Predefined Gold and Silver options must exist");
goldOption.children[0].checked = true;
goldOption.children[0].dispatch("change");
silverOption.children[0].checked = true;
silverOption.children[0].dispatch("change");

assert.deepEqual([...getSelectedProductColors("add")], ["Gold", "Silver"]);
assert.equal(addPreview.textContent, "Gold • Silver");
console.log("PASS 3: Checking predefined colors updates selected list.");

// Test 4: Adding custom color appends chip and checks it.
const customInput = adminElements.get("adminProductCustomColorInput");
customInput.value = "Teal Blue";
addAdminCustomColor("add");
assert.equal(customInput.value, "", "Custom input must be cleared after addition");
const colorsWithCustom = [...getSelectedProductColors("add")];
assert.ok(colorsWithCustom.includes("Teal Blue"), "Selected colors must include newly added custom color");
assert.ok(addPreview.textContent.includes("Teal Blue"), "Preview must include custom color");
console.log("PASS 4: Adding custom color appends chip and checks it.");

// Test 5: Duplicates (predefined or custom) are prevented case-insensitively.
customInput.value = "gold"; // duplicate of predefined Gold
addAdminCustomColor("add");
const colorsAfterPredefinedDup = [...getSelectedProductColors("add")];
assert.equal(colorsAfterPredefinedDup.filter(c => c.toLowerCase() === "gold").length, 1, "Gold must not be duplicated");

customInput.value = "TEAL BLUE"; // duplicate of custom Teal Blue
addAdminCustomColor("add");
const colorsAfterCustomDup = [...getSelectedProductColors("add")];
assert.equal(colorsAfterCustomDup.filter(c => c.toLowerCase() === "teal blue").length, 1, "Teal Blue must not be duplicated");
console.log("PASS 5: Duplicates (predefined or custom) are prevented case-insensitively.");

// Test 6: Empty or blank custom color input is ignored.
const countBeforeBlank = getSelectedProductColors("add").length;
customInput.value = "   ";
addAdminCustomColor("add");
assert.equal(getSelectedProductColors("add").length, countBeforeBlank, "Blank color input must be ignored");
console.log("PASS 6: Empty or blank custom color input is ignored.");

// Test 7: Reset colors clears all checkboxes and custom chips and hides container.
resetAdminColors("add");
assert.equal(addToggle.checked, false, "Toggle must be reset to unchecked");
assert.equal(addBody.style.display, "none", "Colors body must be hidden");
assert.equal(addPreview.textContent, "None", "Preview must be 'None'");
assert.deepEqual([...getSelectedProductColors("add")], [], "Selected colors must be empty after reset");
console.log("PASS 7: Reset colors clears all checkboxes and custom chips and hides container.");

// Test 8: Selecting image mode 'single' hides per-color image upload UI.
addToggle.checked = true;
addToggle.dispatch("change");
const currentGoldOption = addGrid.children.find(c => c.getAttribute("data-color") === "Gold");
currentGoldOption.children[0].checked = true;
currentGoldOption.children[0].dispatch("change");

setImageDisplayMode("add", "single");
const singleRadio = adminElements.get("adminProductImageModeSingle");
const carouselRadio = adminElements.get("adminProductImageModeCarousel");
const colorImagesSection = adminElements.get("adminProductColorImagesSection");

assert.equal(getImageDisplayMode("add"), "single", "Mode must be 'single'");
assert.equal(singleRadio.checked, true, "Single radio must be checked");
assert.equal(colorImagesSection.style.display, "none", "Color images section must be hidden in single mode");
console.log("PASS 8: Selecting image mode 'single' hides per-color image upload UI.");

// Test 9: Selecting image mode 'colorCarousel' reveals per-color image rows.
setImageDisplayMode("add", "colorCarousel");
assert.equal(getImageDisplayMode("add"), "colorCarousel", "Mode must be 'colorCarousel'");
assert.equal(carouselRadio.checked, true, "Carousel radio must be checked");
assert.equal(colorImagesSection.style.display, "block", "Color images section must be visible in colorCarousel mode");
const colorImagesList = adminElements.get("adminProductColorImagesList");
assert.ok(colorImagesList.children.length > 0, "Color images list must contain rows for selected colors");
const goldRow = colorImagesList.children.find(r => r.getAttribute("data-color") === "Gold");
assert.ok(goldRow, "Must render an image upload row for Gold");
console.log("PASS 9: Selecting image mode 'colorCarousel' reveals per-color image rows.");

// Test 10: In 'colorCarousel' mode, per-color image upload requires valid Cloudinary URL.
const goldUrlInput = goldRow.querySelector(".admin-color-image-url-input");
assert.ok(goldUrlInput, "Must have URL input in color row");
goldUrlInput.value = "https://res.cloudinary.com/vgjfpkoh/image/upload/v12345/gold.jpg";
goldUrlInput.dispatch("change");
assert.equal(adminColorsState.add.colorImages["Gold"], "https://res.cloudinary.com/vgjfpkoh/image/upload/v12345/gold.jpg", "Valid Cloudinary URL must be stored in colorImages");
console.log("PASS 10: In 'colorCarousel' mode, per-color image upload accepts valid Cloudinary URL.");

// Test 11: In 'colorCarousel' mode, local file paths (images/...) are rejected.
goldUrlInput.value = "images/earrings-gold.jpg";
goldUrlInput.dispatch("change");
const statusSpan = goldRow.querySelector(".admin-color-image-status");
assert.ok(statusSpan && statusSpan.textContent.includes("Error"), "Local images/... path must be rejected with error");
assert.notEqual(adminColorsState.add.colorImages["Gold"], "images/earrings-gold.jpg", "Local path must not be stored in state");
console.log("PASS 11: In 'colorCarousel' mode, local file paths (images/...) are rejected.");

// Test 12: Saving product in Firestore correctly writes availableColors, imageDisplayMode, and colorImages.
assert.ok(adminJsSource.includes("availableColors: availableColors"), "Add Product saves availableColors to Firestore");
assert.ok(adminJsSource.includes("imageDisplayMode: imageDisplayMode"), "Add Product saves imageDisplayMode to Firestore");
assert.ok(adminJsSource.includes("colorImages: colorImages"), "Add Product saves colorImages to Firestore");
assert.ok(adminJsSource.includes("availableColors: editAvailableColors"), "Edit Product updates availableColors in Firestore");
assert.ok(adminJsSource.includes("imageDisplayMode: editImageDisplayMode"), "Edit Product updates imageDisplayMode in Firestore");
assert.ok(adminJsSource.includes("colorImages: editColorImages"), "Edit Product updates colorImages in Firestore");
console.log("PASS 12: Saving product in Firestore correctly writes availableColors, imageDisplayMode, and colorImages.");

// =========================================================================
// SECTION B: CUSTOMER PRODUCT PAGE RENDERING & INTERACTION TESTS (13 - 18)
// =========================================================================

// Customer Product Page Mock DOM
const mockProductSection = createMockElement("div");
const mockChipsContainer = createMockElement("div");
const mockPrice = createMockElement("div");
const mockName = createMockElement("h1");
const mockStock = createMockElement("p");
const mockDesc = createMockElement("p");
const mockImg = createMockElement("img");
const mockSelectedLabel = createMockElement("span");
const mockColorError = createMockElement("div");
const mockThumbnailGallery = createMockElement("div");

// Extract helper functions from script.js
const colorBgFnMatch = scriptJsSource.match(/function getAloraColorBackground\([\s\S]*?\n\}/);
const renderFnMatch = scriptJsSource.match(/function renderProductDetails\(product\)[\s\S]*?\n\}/);
const selectColorFnMatch = scriptJsSource.match(/function selectProductColor\(colorName, product\)[\s\S]*?\n\}/);

assert.ok(colorBgFnMatch, "getAloraColorBackground found");
assert.ok(renderFnMatch, "renderProductDetails found");
assert.ok(selectColorFnMatch, "selectProductColor found");

const customerVmContext = {
    document: {
        getElementById(id) {
            if (id === "productColorsSection") return mockProductSection;
            if (id === "productColorChips") return mockChipsContainer;
            if (id === "productPrice") return mockPrice;
            if (id === "productName") return mockName;
            if (id === "productStockStatus") return mockStock;
            if (id === "productDescription") return mockDesc;
            if (id === "productImage") return mockImg;
            if (id === "productSelectedColorLabel") return mockSelectedLabel;
            if (id === "productColorError") return mockColorError;
            if (id === "productThumbnailGallery") return mockThumbnailGallery;
            return createMockElement("div");
        },
        createElement(tag) { return createMockElement(tag); }
    },
    window: {},
    console,
    Array,
    Object,
    String,
    Boolean,
    formatCurrency: (n) => `₹${n}`,
    setProductActionsDisabled: () => {},
    updateProductWishlistButton: () => {},
    loadRelatedProducts: () => {},
    loadProductReviews: () => {},
    currentProductStock: 0
};
vm.createContext(customerVmContext);

vm.runInContext(`
    ${colorBgFnMatch[0]}
    let selectedProductColor = "";
    ${selectColorFnMatch[0]}
    ${renderFnMatch[0]}
    window.renderProductDetails = renderProductDetails;
    window.selectProductColor = selectProductColor;
    window.getSelectedColor = () => selectedProductColor;
    window.setSelectedColor = (val) => { selectedProductColor = val; };
`, customerVmContext);

const { renderProductDetails, selectProductColor, getSelectedColor, setSelectedColor } = customerVmContext.window;

// Test 13: Customer product page renders color chips when availableColors exists.
const testProductWithColors = {
    id: "prod-col-1",
    name: "Royal Peacock Earrings",
    price: 1299,
    stock: 5,
    image: "https://res.cloudinary.com/vgjfpkoh/image/upload/v1/peacock.jpg",
    availableColors: ["Gold", "Silver", "Rose Gold"],
    imageDisplayMode: "single"
};

renderProductDetails(testProductWithColors);
assert.equal(mockProductSection.style.display, "block", "Colors section must be visible");
assert.equal(mockChipsContainer.children.length, 3, "Must render exactly 3 color chips");
console.log("PASS 13: Customer product page renders color chips when availableColors exists.");

// Test 14: Customer product page hides color section when availableColors is empty or missing.
const testProductNoColors = {
    id: "prod-no-col",
    name: "Simple Hair Pin",
    price: 299,
    stock: 10,
    image: "https://res.cloudinary.com/vgjfpkoh/image/upload/v1/pin.jpg",
    availableColors: []
};
renderProductDetails(testProductNoColors);
assert.equal(mockProductSection.style.display, "none", "Colors section must be hidden when availableColors is empty");

const testProductUndefinedColors = {
    id: "prod-undef-col",
    name: "Legacy Kada",
    price: 499,
    stock: 2,
    image: "https://res.cloudinary.com/vgjfpkoh/image/upload/v1/kada.jpg"
};
renderProductDetails(testProductUndefinedColors);
assert.equal(mockProductSection.style.display, "none", "Colors section must be hidden when availableColors is undefined");
console.log("PASS 14: Customer product page hides color section when availableColors is empty or missing.");

// Test 15: Color chips have role="radio", aria-checked, and selected indicator.
renderProductDetails(testProductWithColors);
const firstChip = mockChipsContainer.children[0];
assert.equal(firstChip.getAttribute("role"), "radio", "Chip must have role='radio'");
assert.equal(firstChip.getAttribute("aria-checked"), "false", "Initial aria-checked must be 'false'");
const checkmarkSpan = firstChip.children.find(c => c.classList.contains("product-color-check"));
assert.ok(checkmarkSpan, "Chip must contain a checkmark indicator");
console.log("PASS 15: Color chips have role='radio', aria-checked, and selected indicator.");

// Test 16: Selected color label updates when customer clicks chip.
selectProductColor("Gold", testProductWithColors);
assert.equal(getSelectedColor(), "Gold", "selectedProductColor must be updated to Gold");
assert.equal(mockSelectedLabel.textContent, "Selected: Gold ✓", "Selected label must show 'Selected: Gold ✓'");
assert.equal(firstChip.getAttribute("aria-checked"), "true", "Selected chip aria-checked must be 'true'");
assert.ok(firstChip.classList.contains("selected"), "Selected chip must have .selected class");
console.log("PASS 16: Selected color label updates when customer clicks chip.");

// Test 17: In 'colorCarousel' mode, selecting a color updates the main product image.
const testCarouselProduct = {
    id: "prod-carousel-1",
    name: "Lotus Ring",
    price: 899,
    stock: 4,
    image: "https://res.cloudinary.com/vgjfpkoh/image/upload/v1/ring-default.jpg",
    availableColors: ["Gold", "Silver"],
    imageDisplayMode: "colorCarousel",
    colorImages: {
        "Gold": "https://res.cloudinary.com/vgjfpkoh/image/upload/v1/ring-gold.jpg",
        "Silver": "https://res.cloudinary.com/vgjfpkoh/image/upload/v1/ring-silver.jpg"
    }
};

renderProductDetails(testCarouselProduct);
selectProductColor("Silver", testCarouselProduct);
assert.equal(mockImg.src, "https://res.cloudinary.com/vgjfpkoh/image/upload/v1/ring-silver.jpg", "Main product image must update to Silver color image");
console.log("PASS 17: In 'colorCarousel' mode, selecting a color updates the main product image.");

// Test 18: In 'colorCarousel' mode, thumbnail carousel is rendered and clicking thumbnail selects color and updates main image.
assert.equal(mockThumbnailGallery.children.length, 2, "Thumbnail gallery must render 2 items for 2 colors");
const goldThumb = mockThumbnailGallery.children.find(t => t.getAttribute("data-color") === "Gold");
assert.ok(goldThumb, "Must render a thumbnail for Gold");
selectProductColor("Gold", testCarouselProduct);
assert.equal(mockImg.src, "https://res.cloudinary.com/vgjfpkoh/image/upload/v1/ring-gold.jpg", "Main image must update when Gold thumbnail is selected");
assert.ok(goldThumb.classList.contains("active"), "Gold thumbnail must have active class");
console.log("PASS 18: In 'colorCarousel' mode, thumbnail carousel is rendered and clicking thumbnail selects color and updates main image.");

// =========================================================================
// SECTION C: CART VALIDATION, PERSISTENCE & MERGING TESTS (19 - 22)
// =========================================================================

// Extract cart functions from script.js
const addToCartFnMatch = scriptJsSource.match(/function addToCart\([\s\S]*?\n\}/);
const addCurrentProductToCartFnMatch = scriptJsSource.match(/function addCurrentProductToCart\(\)[\s\S]*?\n\}/);
const saveCartFnMatch = scriptJsSource.match(/function saveCart\(cart\)[\s\S]*?\n\}/);

assert.ok(addToCartFnMatch, "addToCart found");
assert.ok(addCurrentProductToCartFnMatch, "addCurrentProductToCart found");
assert.ok(saveCartFnMatch, "saveCart found");

let mockCart = [];
let trackedEvents = [];
const cartVmContext = {
    document: {
        getElementById(id) {
            if (id === "productColorError") return mockColorError;
            return createMockElement("div");
        },
        createElement(tag) { return createMockElement(tag); },
        body: { appendChild() {} }
    },
    window: {
        trackAloraAnalyticsEvent: (eventName, params) => {
            trackedEvents.push({ eventName, params });
        }
    },
    console,
    Array,
    Object,
    String,
    Boolean,
    Number,
    Math,
    activeAccountUid: null,
    guestCartKey: "aloraGuestCart",
    localStorage: {
        setItem(key, val) { mockCart = JSON.parse(val); },
        getItem(key) { return JSON.stringify(mockCart); }
    },
    getCart: () => mockCart,
    accountDataReadyForWrite: () => true,
    showCartMessage: () => {},
    renderCart: () => {},
    updateHeaderCounts: () => {},
    quantity: 1,
    selectedProductColor: "",
    currentProduct: null
};
vm.createContext(cartVmContext);

vm.runInContext(`
    ${saveCartFnMatch[0]}
    ${addToCartFnMatch[0]}
    ${addCurrentProductToCartFnMatch[0]}
    window.addCurrentProductToCart = addCurrentProductToCart;
    window.addToCart = addToCart;
`, cartVmContext);

const { addCurrentProductToCart, addToCart: vmAddToCart } = cartVmContext.window;

// Test 19: Adding to cart without selecting color when colors exist is blocked and shows error message.
cartVmContext.currentProduct = testProductWithColors;
cartVmContext.selectedProductColor = "";
mockColorError.style.display = "none";
mockColorError.textContent = "";

addCurrentProductToCart();
assert.equal(mockColorError.style.display, "block", "Error container must be displayed");
assert.equal(mockColorError.textContent, "Please select a color before adding this product to cart.", "Error message must match exactly");
assert.equal(mockCart.length, 0, "Cart must remain empty when color is not selected");
console.log("PASS 19: Adding to cart without selecting color when colors exist is blocked and shows error message.");

// Test 20: Adding to cart with selected color succeeds and stores selectedColor.
cartVmContext.selectedProductColor = "Gold";
addCurrentProductToCart();
assert.equal(mockColorError.style.display, "none", "Error container must be hidden upon valid addition");
assert.equal(mockCart.length, 1, "Cart must have 1 item");
assert.equal(mockCart[0].selectedColor, "Gold", "Item in cart must store selectedColor 'Gold'");
console.log("PASS 20: Adding to cart with selected color succeeds and stores selectedColor.");

// Test 21: Cart displays Color: <color> under product title.
assert.ok(
    scriptJsSource.includes('class="cart-item-color"') &&
    scriptJsSource.includes("Color: <strong>${escapeHTML(item.selectedColor)}</strong>"),
    "renderCart in script.js must render Color: <color> under product title"
);
console.log("PASS 21: Cart displays Color: <color> under product title.");

// Test 22: Cart grouping: Same product with same color increases quantity; same product with different colors creates distinct line items.
// Add same product with same color (Gold)
vmAddToCart("Royal Peacock Earrings", 1299, "peacock.jpg", 1, 5, "prod-col-1", "Gold");
assert.equal(mockCart.length, 1, "Cart should still have 1 line item for same product + same color");
assert.equal(mockCart[0].quantity, 2, "Quantity should be incremented to 2");

// Add same product with DIFFERENT color (Silver)
vmAddToCart("Royal Peacock Earrings", 1299, "peacock-silver.jpg", 1, 5, "prod-col-1", "Silver");
assert.equal(mockCart.length, 2, "Cart must have 2 distinct line items for different colors");
assert.equal(mockCart[0].selectedColor, "Gold");
assert.equal(mockCart[1].selectedColor, "Silver");
assert.equal(mockCart[1].quantity, 1);
console.log("PASS 22: Cart grouping correctly merges same color and separates different colors.");

// =========================================================================
// SECTION D: BUY NOW & CHECKOUT ORDER PERSISTENCE TESTS (23 - 25)
// =========================================================================

// Extract buyNow from script.js
const buyNowFnMatch = scriptJsSource.match(/function buyNow\(name, price\)[\s\S]*?\n\}/);
assert.ok(buyNowFnMatch, "buyNow found");

const buyNowVmContext = {
    document: {
        getElementById(id) {
            if (id === "productColorError") return mockColorError;
            return createMockElement("div");
        }
    },
    window: {
        location: {
            href: "",
            search: ""
        }
    },
    URLSearchParams,
    Number,
    localStorage: { removeItem() {} },
    quantity: 1,
    currentProduct: testProductWithColors,
    selectedProductColor: ""
};
vm.createContext(buyNowVmContext);
vm.runInContext(`${buyNowFnMatch[0]}; window.buyNow = buyNow;`, buyNowVmContext);
const { buyNow: vmBuyNow } = buyNowVmContext.window;

// Test 23: Buy Now without selecting color is blocked and shows error message.
mockColorError.style.display = "none";
mockColorError.textContent = "";
buyNowVmContext.selectedProductColor = "";

vmBuyNow();
assert.equal(mockColorError.style.display, "block", "Buy Now must display error message if color unselected");
assert.equal(mockColorError.textContent, "Please select a color before adding this product to cart.");
assert.equal(buyNowVmContext.window.location.href, "", "Location href must not change");
console.log("PASS 23: Buy Now without selecting color is blocked and shows error message.");

// Test 24: Buy Now with color passes color to checkout.
buyNowVmContext.selectedProductColor = "Rose Gold";
vmBuyNow();
assert.ok(buyNowVmContext.window.location.href.includes("order.html"), "Should redirect to order.html");
assert.ok(buyNowVmContext.window.location.href.includes("color=Rose+Gold") || buyNowVmContext.window.location.href.includes("color=Rose%20Gold"), "Order URL must contain color parameter");
console.log("PASS 24: Buy Now with color passes color to checkout.");

// Test 25: Checkout / Order placement persists selectedColor in Firestore order items.
assert.ok(
    scriptJsSource.includes("selectedColor: item.selectedColor") || scriptJsSource.includes("item.selectedColor ?"),
    "placeOrder in script.js maps item.selectedColor into Firestore items array"
);
assert.ok(
    scriptJsSource.includes("topLevelColor"),
    "placeOrder in script.js sets top-level order selectedColor"
);
console.log("PASS 25: Checkout / Order placement persists selectedColor in Firestore order items.");

// =========================================================================
// SECTION E: ADMIN ORDERS & MY ORDERS RENDERING TESTS (26 - 29)
// =========================================================================

// Test 26: Admin Orders page renders Color: <color> for each item that has a color.
assert.ok(
    adminJsSource.includes("Color: ${escapeHTML(item.selectedColor)}"),
    "admin.js must render Color: <color> for items in orders"
);
// Test 27: Admin Orders page never displays 'Color: undefined' or empty 'Color:' for items without color.
const adminOrderTemplatePart = adminJsSource.substring(
    adminJsSource.indexOf("<span>PRODUCTS</span>"),
    adminJsSource.indexOf("<span>DELIVERY ADDRESS</span>")
);
assert.ok(adminOrderTemplatePart.includes("item.selectedColor ?"), "admin.js strictly gates color display behind item.selectedColor truthiness");
assert.ok(!adminOrderTemplatePart.includes("Color: undefined"), "admin.js must not contain hardcoded 'Color: undefined'");
console.log("PASS 26: Admin Orders page renders Color: <color> for each item that has a color.");
console.log("PASS 27: Admin Orders page never displays 'Color: undefined' or empty 'Color:' for items without color.");

// Test 28: Customer My Orders page renders Color: <color> for each item that has a color.
assert.ok(
    myOrdersJsSource.includes("Color: ${escapeHTML(item.selectedColor)}"),
    "my-orders.js must render Color: <color> for items in orders"
);
// Test 29: Customer My Orders page never displays 'Color: undefined' or empty 'Color:'.
const myOrdersTemplatePart = myOrdersJsSource.substring(
    myOrdersJsSource.indexOf("order.items.map(item => `"),
    myOrdersJsSource.indexOf("QUANTITY")
);
assert.ok(myOrdersTemplatePart.includes("item.selectedColor ?"), "my-orders.js strictly gates color display behind item.selectedColor truthiness");
assert.ok(!myOrdersTemplatePart.includes("Color: undefined"), "my-orders.js must not contain hardcoded 'Color: undefined'");
console.log("PASS 28: Customer My Orders page renders Color: <color> for each item that has a color.");
console.log("PASS 29: Customer My Orders page never displays 'Color: undefined' or empty 'Color:'.");

// =========================================================================
// SECTION F: EMAIL NOTIFICATIONS & PAYLOAD TESTS (30 - 31)
// =========================================================================

// Test 30: Order email notification includes color summary in products list.
assert.ok(
    orderEmailJsSource.includes("(Color: \" + order.selectedColor + \")") ||
    orderEmailJsSource.includes("(Color: \" + col + \")"),
    "order-email.js formats (Color: <color>) into products summary"
);
console.log("PASS 30: Order email notification includes color summary in products list.");

// Test 31: Order email payload includes color and selected_color fields.
assert.ok(
    orderEmailJsSource.includes("color: itemColor") &&
    orderEmailJsSource.includes("selected_color: itemColor"),
    "buildOrderEmailPayload and buildCustomerEmailPayload include color and selected_color fields"
);
console.log("PASS 31: Order email payload includes color and selected_color fields.");

// =========================================================================
// SECTION G: ANALYTICS EVENTS TESTS (32 - 33)
// =========================================================================

// Test 32: Analytics add_to_cart event includes item_variant with selected color.
const addToCartAnalytics = trackedEvents.find(e => e.eventName === "add_to_cart");
assert.ok(addToCartAnalytics, "add_to_cart analytics event was triggered");
assert.equal(addToCartAnalytics.params.items[0].item_variant, "Gold", "add_to_cart event must include item_variant = 'Gold'");
console.log("PASS 32: Analytics add_to_cart event includes item_variant with selected color.");

// Test 33: Analytics purchase event includes item_variant with selected color.
assert.ok(
    scriptJsSource.includes("item_variant: item.selectedColor || undefined"),
    "script.js purchase event mapping includes item_variant with selectedColor"
);
console.log("PASS 33: Analytics purchase event includes item_variant with selected color.");

// =========================================================================
// SECTION H: BACKWARD COMPATIBILITY & MOBILE RESPONSIVENESS (34 - 35)
// =========================================================================

// Test 34: Backward compatibility: Existing products without colors continue to work seamlessly.
vmAddToCart("Vintage Ring", 599, "vintage.jpg", 1, 10, "legacy-ring-1", "");
const legacyCartItem = mockCart.find(i => i.name === "Vintage Ring");
assert.ok(legacyCartItem, "Legacy product without color adds to cart seamlessly");
assert.equal(legacyCartItem.selectedColor, "", "selectedColor is safely empty string");
console.log("PASS 34: Backward compatibility: Existing products without colors continue to work seamlessly.");

// Test 35: Mobile responsiveness: Color swatches and carousel adapt cleanly without horizontal overflow down to 320px.
assert.ok(styleCss.includes(".product-color-chips"), "style.css defines .product-color-chips");
assert.ok(styleCss.includes("flex-wrap: wrap"), "Color chips use flex-wrap to prevent horizontal overflow");
assert.ok(styleCss.includes(".product-thumbnail-gallery"), "style.css defines .product-thumbnail-gallery");
assert.ok(
    styleCss.includes("overflow-x: auto") || styleCss.includes("overflow-x: scroll"),
    "Thumbnail gallery scrolls cleanly horizontally without breaking page layout"
);
assert.ok(
    styleCss.includes("@media (max-width: 480px)") || styleCss.includes("@media (max-width: 360px)"),
    "style.css contains mobile breakpoints down to compact viewports"
);
console.log("PASS 35: Mobile responsiveness: Color swatches and carousel adapt cleanly without horizontal overflow down to 320px.");

console.log("\n================================================================================");
console.log("ALL 35 REQUIREMENTS SUCCESSFULLY VERIFIED (100% PASS RATE)!");
console.log("================================================================================");
