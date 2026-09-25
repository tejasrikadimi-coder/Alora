/* =====================================================
   ALORA FIRESTORE PRODUCTS
   HOME + COLLECTIONS
===================================================== */

import {
    db
} from "./firebase.js";


import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


const productsContainer =
    document.getElementById("products");

/* =====================================================
   CATEGORIZATION & BADGES HELPERS
===================================================== */

export function determineProductCategory(product) {
    if (!product) return "Custom Jewellery";
    if (product.category && typeof product.category === "string" && product.category.trim()) {
        const cat = product.category.trim();
        const validCats = [
            "Earrings", "Necklaces", "Bangles", "Hair Pins",
            "Kids Jewellery", "Rings", "Custom Jewellery"
        ];
        const match = validCats.find(c => c.toLowerCase() === cat.toLowerCase());
        if (match) return match;
    }
    const text = ((product.name || "") + " " + (product.description || "")).toLowerCase();
    if (text.includes("earring") || text.includes("jhumka") || text.includes("stud") || text.includes("drop")) {
        return "Earrings";
    }
    if (text.includes("choker") || text.includes("neck") || text.includes("pendant") || text.includes("haar") || text.includes("chain")) {
        return "Necklaces";
    }
    if (text.includes("bangle") || text.includes("bracelet") || text.includes("kada")) {
        return "Bangles";
    }
    if (text.includes("ring")) {
        return "Rings";
    }
    if (text.includes("hair") || text.includes("pin") || text.includes("clip")) {
        return "Hair Pins";
    }
    if (text.includes("kid") || text.includes("child") || text.includes("baby")) {
        return "Kids Jewellery";
    }
    return "Custom Jewellery";
}
window.determineProductCategory = determineProductCategory;

export function determineProductBadge(product) {
    if (!product) return null;
    if (Number(product.stock) <= 0) {
        return { text: "Out of Stock", className: "badge-out-of-stock" };
    }
    if (product.badge) {
        const b = String(product.badge).toLowerCase();
        if (b.includes("new")) return { text: "NEW", className: "badge-new" };
        if (b.includes("best") || b.includes("bestseller")) return { text: "BEST SELLER", className: "badge-bestseller" };
        if (b.includes("custom")) return { text: "CUSTOMIZABLE", className: "badge-custom" };
    }
    if (product.isBestSeller || product.bestSeller) {
        return { text: "BEST SELLER", className: "badge-bestseller" };
    }
    if (product.isNew) {
        return { text: "NEW", className: "badge-new" };
    }
    if (product.customizable || product.category === "Custom Jewellery") {
        return { text: "CUSTOMIZABLE", className: "badge-custom" };
    }
    if (product.createdAt) {
        try {
            const created = new Date(product.createdAt).getTime();
            const now = Date.now();
            if (now - created < 30 * 24 * 60 * 60 * 1000) {
                return { text: "NEW", className: "badge-new" };
            }
        } catch (_) {}
    }
    return null;
}
window.determineProductBadge = determineProductBadge;

let allLoadedProducts = [];
let currentCategory = "All";
let currentSort = "featured";
let inStockOnly = false;
let currentSearchQuery = "";
let currentMinPrice = null;
let currentMaxPrice = null;
let controlsInitialized = false;

function applyFiltersAndRender() {
    let result = [...allLoadedProducts];

    // Filter by category
    if (currentCategory && currentCategory !== "All") {
        result = result.filter(p => p.category.toLowerCase() === currentCategory.toLowerCase());
    }

    // Filter by in-stock only
    if (inStockOnly) {
        result = result.filter(p => p.stock > 0);
    }

    // Filter by search query
    if (currentSearchQuery) {
        const q = currentSearchQuery.toLowerCase();
        result = result.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        );
    }

    // Filter by manual price range (min, max, or both)
    if (currentMinPrice !== null && !isNaN(currentMinPrice)) {
        result = result.filter(p => Number(p.price) >= currentMinPrice);
    }
    if (currentMaxPrice !== null && !isNaN(currentMaxPrice)) {
        result = result.filter(p => Number(p.price) <= currentMaxPrice);
    }

    // Sort
    if (currentSort === "price-low") {
        result.sort((a, b) => a.price - b.price);
    } else if (currentSort === "price-high") {
        result.sort((a, b) => b.price - a.price);
    } else if (currentSort === "name-asc") {
        result.sort((a, b) => a.name.localeCompare(b.name));
    }

    renderProducts(result);
}

function setupCollectionsControls() {
    if (controlsInitialized) return;
    controlsInitialized = true;

    // 1. URL params check
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const categoryParam = urlParams.get("category");
        if (categoryParam) {
            currentCategory = categoryParam;
        }
        const searchParam = urlParams.get("search");
        if (searchParam) {
            currentSearchQuery = searchParam;
        }
    } catch (_) {}

    // 2. Category pills
    const pillsContainer = document.getElementById("categoryPills");
    if (pillsContainer) {
        const pills = pillsContainer.querySelectorAll(".category-pill");
        pills.forEach(pill => {
            if (pill.dataset.category.toLowerCase() === currentCategory.toLowerCase()) {
                pills.forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
            }
            pill.addEventListener("click", () => {
                pills.forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                currentCategory = pill.dataset.category;
                applyFiltersAndRender();
            });
        });
    }

    // 3. Sort Select
    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            currentSort = sortSelect.value;
            applyFiltersAndRender();
        });
    }

    // 4. In Stock Filter
    const inStockCheckbox = document.getElementById("inStockFilter");
    if (inStockCheckbox) {
        inStockCheckbox.addEventListener("change", () => {
            inStockOnly = inStockCheckbox.checked;
            applyFiltersAndRender();
        });
    }

    // 5. Search Input
    const searchInput = document.getElementById("search");
    if (searchInput) {
        if (currentSearchQuery) {
            searchInput.value = currentSearchQuery;
        }
        searchInput.addEventListener("input", () => {
            currentSearchQuery = searchInput.value.trim();
            applyFiltersAndRender();
        });
    }

    // 6. Manual Price Range Filter
    const minPriceInput = document.getElementById("minPriceInput");
    const maxPriceInput = document.getElementById("maxPriceInput");
    const applyPriceBtn = document.getElementById("applyPriceBtn");
    const clearPriceBtn = document.getElementById("clearPriceBtn");

    if (minPriceInput && currentMinPrice !== null) {
        minPriceInput.value = currentMinPrice;
    }
    if (maxPriceInput && currentMaxPrice !== null) {
        maxPriceInput.value = currentMaxPrice;
    }

    function handleApplyPrice() {
        const rawMin = minPriceInput ? minPriceInput.value.trim() : "";
        const rawMax = maxPriceInput ? maxPriceInput.value.trim() : "";

        let minVal = rawMin !== "" ? Number(rawMin) : null;
        let maxVal = rawMax !== "" ? Number(rawMax) : null;

        if (minVal !== null && (isNaN(minVal) || minVal < 0)) minVal = null;
        if (maxVal !== null && (isNaN(maxVal) || maxVal < 0)) maxVal = null;

        // If both are provided and min > max, auto-swap for smooth UX
        if (minVal !== null && maxVal !== null && minVal > maxVal) {
            const temp = minVal;
            minVal = maxVal;
            maxVal = temp;
            if (minPriceInput) minPriceInput.value = minVal;
            if (maxPriceInput) maxPriceInput.value = maxVal;
        }

        currentMinPrice = minVal;
        currentMaxPrice = maxVal;
        applyFiltersAndRender();
    }

    if (applyPriceBtn) {
        applyPriceBtn.addEventListener("click", handleApplyPrice);
    }

    if (clearPriceBtn) {
        clearPriceBtn.addEventListener("click", () => {
            if (minPriceInput) minPriceInput.value = "";
            if (maxPriceInput) maxPriceInput.value = "";
            currentMinPrice = null;
            currentMaxPrice = null;
            applyFiltersAndRender();
        });
    }

    [minPriceInput, maxPriceInput].forEach(inp => {
        if (inp) {
            inp.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyPrice();
                }
            });
        }
    });
}


/* =====================================================
   LOAD PRODUCTS
===================================================== */

async function loadFirestoreProducts() {
    if (!productsContainer) {
        return;
    }


    productsContainer.innerHTML = `
        <div class="products-loading">
            Loading jewellery...
        </div>
    `;


    try {
        const productsReference =
            collection(db, "products");

        const productsSnapshot =
            await getDocs(productsReference);


        const firestoreProducts = [];


        productsSnapshot.forEach(productDocument => {
            const product =
                productDocument.data();


            /* HIDE INACTIVE PRODUCTS */

            if (product.active === false) {
                return;
            }


            firestoreProducts.push({
                id: productDocument.id,

                name:
                    product.name || "Alora Jewellery",

                price:
    Number(product.price) || 0,

stock:
    Number.isFinite(
        Number(product.stock)
    )
        ? Number(product.stock)
        : 0,

image:
    product.image || "",

images:
    Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : (product.image ? [product.image] : []),

                description:
                    product.description ||
                    "Handcrafted Alora jewellery.",

                category:
                    determineProductCategory(product),

                badge:
                    determineProductBadge(product),

                createdAt:
                    product.createdAt || ""
            });
        });


        /* NEW PRODUCTS FIRST */

        firestoreProducts.reverse();
        allLoadedProducts = firestoreProducts;

        setupCollectionsControls();
        applyFiltersAndRender();

    } catch (error) {
        console.error(
            "Products loading failed:",
            error
        );


        productsContainer.innerHTML = `
            <div class="products-error">

                <h2>Unable to Load Products</h2>

                <p>
                    Please refresh the page and try again.
                </p>

            </div>
        `;
    }
}


/* =====================================================
   RENDER PRODUCTS
===================================================== */

function renderProducts(products) {
    productsContainer.innerHTML = "";


    if (products.length === 0) {
        productsContainer.innerHTML = `
            <div class="products-empty">

                <h2>No Products Available</h2>

                <p>
                    New Alora jewellery is coming soon.
                </p>

            </div>
        `;

        return;
    }


    products.forEach(product => {
        const card =
            document.createElement("article");


        card.className = "card";


        /* OPEN PRODUCT DETAILS */

        card.addEventListener(
            "click",
            function () {
                if (
                    typeof window.openProduct ===
                    "function"
                ) {
                    window.openProduct(
                        product.name,
                        product.price,
                        product.image,
                        product.stock,
                        product.id
                    );
                }
            }
        );


        /* PRODUCT IMAGE */

        const imageContainer =
            document.createElement("div");

        imageContainer.className =
            "product-image";

        if (product.badge) {
            const badgeEl = document.createElement("span");
            badgeEl.className = "product-card-badge " + product.badge.className;
            badgeEl.textContent = product.badge.text;
            imageContainer.appendChild(badgeEl);
        }


        const image =
            document.createElement("img");

        image.src = product.image;

        image.alt = product.name;

        image.loading = "lazy";


        image.addEventListener(
            "error",
            function () {
                image.src =
                    "https://placehold.co/600x600/f5f1eb/b68b00?text=Alora";
            }
        );


        /* WISHLIST BUTTON */

        const wishlistButton =
            document.createElement("button");

        wishlistButton.type = "button";

        wishlistButton.className =
            "wishlist-btn";

        wishlistButton.dataset.name =
            product.name;

        wishlistButton.dataset.id =
            product.id || "";

        const isWishlisted =
            typeof window.isProductInWishlist === "function"
                ? window.isProductInWishlist(product.name, product.id)
                : (function () {
                    try {
                        const stored = JSON.parse(
                            localStorage.getItem("aloraWishlist") || "[]"
                        );
                        return Array.isArray(stored) && stored.some(item =>
                            (product.id && item.id === product.id) ||
                            (product.name && item.name && item.name.trim().toLowerCase() === product.name.trim().toLowerCase())
                        );
                    } catch (e) {
                        return false;
                    }
                })();

        if (isWishlisted) {
            wishlistButton.classList.add("active");
            wishlistButton.textContent = "♥";
            wishlistButton.title = "Remove from Wishlist";
            wishlistButton.setAttribute(
                "aria-label",
                "Remove " + product.name + " from wishlist"
            );
        } else {
            wishlistButton.classList.remove("active");
            wishlistButton.textContent = "♡";
            wishlistButton.title = "Add to Wishlist";
            wishlistButton.setAttribute(
                "aria-label",
                "Add " + product.name + " to wishlist"
            );
        }

        wishlistButton.addEventListener(
            "click",
            function (event) {
                event.stopPropagation();
                event.preventDefault();

                if (
                    typeof window.toggleWishlist ===
                    "function"
                ) {
                    window.toggleWishlist(
                        product.name,
                        product.price,
                        product.image,
                        wishlistButton,
                        product.stock,
                        product.id
                    );
                }
            }
        );


        imageContainer.appendChild(image);

        imageContainer.appendChild(
            wishlistButton
        );


        /* PRODUCT CONTENT */

        const cardContent =
            document.createElement("div");

        cardContent.className =
            "card-content";


        const productName =
            document.createElement("h3");

        productName.textContent =
            product.name;


        const productPrice =
            document.createElement("p");

        productPrice.className =
            "product-price";

        productPrice.textContent =
            "₹" + product.price;
            /* STOCK STATUS */

const stockStatus =
    document.createElement("p");

stockStatus.className =
    "product-stock-status";


if (product.stock <= 0) {
    stockStatus.textContent =
        "Out of Stock";

    stockStatus.classList.add(
        "out-of-stock"
    );

} else if (product.stock <= 5) {
    stockStatus.textContent =
        "Only " +
        product.stock +
        " left";

    stockStatus.classList.add(
        "low-stock"
    );

} else {
    stockStatus.textContent =
        "In Stock";

    stockStatus.classList.add(
        "in-stock"
    );
}


        /* PRODUCT BUTTONS */

        const cardActions =
            document.createElement("div");

        cardActions.className =
            "card-actions";


        /* BUY NOW */

        const buyButton =
            document.createElement("button");

        buyButton.type = "button";

        buyButton.className =
            "buy-btn";

        buyButton.textContent =
            "Buy Now";


        buyButton.addEventListener(
            "click",
            function (event) {
                event.stopPropagation();


                if (
                    typeof window.buyNow ===
                    "function"
                ) {
                    window.buyNow(
                        product.name,
                        product.price
                    );
                }
            }
        );


        /* ADD TO CART */

        const cartButton =
            document.createElement("button");

        cartButton.type = "button";

        cartButton.className =
            "cart-btn";

        cartButton.textContent =
            "Add to Cart";


        cartButton.addEventListener(
            "click",
            function (event) {
                event.stopPropagation();


                if (
                    typeof window.addToCart ===
                    "function"
                ) {
                    window.addToCart(
                        product.name,
                        product.price,
                        product.image,
                        1,
    product.stock,
    product.id
                    );
                }
            }
        );
        /* DISABLE PURCHASE FOR OUT-OF-STOCK PRODUCT */

if (product.stock <= 0) {
    buyButton.disabled = true;
    cartButton.disabled = true;

    buyButton.textContent =
        "Out of Stock";

    cartButton.textContent =
        "Unavailable";

    buyButton.classList.add(
        "disabled"
    );

    cartButton.classList.add(
        "disabled"
    );
}


        cardActions.appendChild(
            buyButton
        );

        cardActions.appendChild(
            cartButton
        );


        cardContent.appendChild(
            productName
        );

        cardContent.appendChild(
            productPrice
        );
        cardContent.appendChild(
    stockStatus
);

        cardContent.appendChild(
            cardActions
        );


        card.appendChild(
            imageContainer
        );

        card.appendChild(
            cardContent
        );


        productsContainer.appendChild(
            card
        );
    });


    /* UPDATE SAVED WISHLIST HEARTS */

    if (
        typeof window.updateWishlistButtons ===
        "function"
    ) {
        window.updateWishlistButtons();
    }
}


/* =====================================================
   START PRODUCT LOADING
===================================================== */

loadFirestoreProducts();