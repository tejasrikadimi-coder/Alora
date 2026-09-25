 /* =====================================================
   ALORA HANDMADE JEWELRY
   FINAL MAIN JAVASCRIPT
===================================================== */


/* =====================================================
   PRODUCT DATA
===================================================== */

const products = [
    {
        name: "Lotus Neckset",
        price: 999,
        image: "images/lotus neckset.jpeg"
    },
    {
        name: "Hair Pins",
        price: 299,
        image: "images/Hairpins.jpeg"
    },
    {
        name: "Designer Hair Pins",
        price: 349,
        image: "images/hairpins2.jpeg"
    },
    {
        name: "Brooch & Earrings",
        price: 799,
        image: "images/Broochpin and earrings.jpeg"
    }
];


let quantity = 1;
let orderUnitPrice = 0;
let isCartCheckout = false;
let placeOrderInFlight = false;
let placeOrderCompleted = false;
let currentProductStock =
    Number.POSITIVE_INFINITY;
let currentProduct = null;

let activeAccountUid = null;
let authStateKnown = false;
let accountDataLoaded = false;
let accountDataError = null;
let accountWishlist = [];
let accountCart = [];
let accountPersistencePromise = null;
let firestoreModulesPromise = null;
const completedCartCleanupKey =
    "aloraCompletedCartCleanups";
let contactAuthUser = null;
let contactMessageInFlight = false;

const guestWishlistKey = "aloraWishlist";
const guestCartKey = "aloraCart";
const ALORA_UPI_ID = "9392159623@ybl";
const onlinePaymentMethod = "Online Payment (UPI)";


/* =====================================================
   MOBILE MENU
===================================================== */

function toggleMenu() {
    const nav = document.getElementById("navMenu");
    const toggleBtn =
        typeof document.querySelector === "function"
            ? document.querySelector(".menu-toggle")
            : null;

    if (nav) {
        const isActive = nav.classList.toggle("active");
        if (toggleBtn && typeof toggleBtn.setAttribute === "function") {
            toggleBtn.setAttribute("aria-expanded", isActive ? "true" : "false");
        }
    }
}


/* =====================================================
   STORAGE HELPER
===================================================== */

function getStoredArray(key) {
    try {
        const data = JSON.parse(
            localStorage.getItem(key)
        );

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {
        return [];
    }
}

    function getFirestoreModules() {
        if (!firestoreModulesPromise) {
            firestoreModulesPromise = Promise.all([
                import("./firebase.js"),
                import(
                    "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js"
                )
            ]).then(function (modules) {
                return {
                    firebase: modules[0],
                    firestore: modules[1]
                };
            });
        }

        return firestoreModulesPromise;
    }

    function getAccountCollectionPath(uid, collectionName) {
        return [
            "users",
            uid,
            collectionName
        ];
    }

    function isPositiveInteger(value) {
        return Number.isInteger(value) && value > 0;
    }

    function getCartCleanupMarkers() {
        try {
            const markers =
                JSON.parse(
                    localStorage.getItem(
                        completedCartCleanupKey
                    )
                );

            return markers &&
                typeof markers === "object"
                ? markers
                : {};
        } catch (error) {
            return {};
        }
    }

    async function cleanupPurchasedAccountCart(
        uid,
        orderId,
        checkoutSnapshot
    ) {
        if (
            !uid ||
            !orderId ||
            !Array.isArray(checkoutSnapshot) ||
            checkoutSnapshot.length === 0
        ) {
            return;
        }

        if (activeAccountUid !== uid) {
            throw new Error(
                "The account changed before cart cleanup completed."
            );
        }

        const markers =
            getCartCleanupMarkers();
        const markerKey =
            uid + ":" + orderId;

        if (markers[markerKey]) {
            return;
        }

        const modules =
            await getFirestoreModules();
        const firestore =
            modules.firestore;
        const firebase =
            modules.firebase;
        const cartReference =
            firestore.collection(
                firebase.db,
                ...getAccountCollectionPath(
                    uid,
                    "cart"
                )
            );
        const snapshot =
            await firestore.getDocs(
                cartReference
            );
        const stagedQuantities =
            new Map();

        checkoutSnapshot.forEach(function (item) {
            if (
                !item ||
                !item.id
            ) {
                throw new Error(
                    "The cart checkout snapshot is missing a product ID."
                );
            }

            if (
                isPositiveInteger(
                    Number(item.quantity)
                )
            ) {
                stagedQuantities.set(
                    item.id,
                    (
                        stagedQuantities.get(item.id) ||
                        0
                    ) + Number(item.quantity)
                );
            }
        });

        const batch =
            firestore.writeBatch(firebase.db);
        let changed = false;

        snapshot.forEach(function (cartDocument) {
            const purchasedQuantity =
                stagedQuantities.get(
                    cartDocument.id
                );

            if (!purchasedQuantity) {
                return;
            }

            const currentQuantity =
                Number(
                    cartDocument.data().quantity
                );
            const remainingQuantity =
                Math.max(
                    0,
                    (
                        isPositiveInteger(
                            currentQuantity
                        )
                            ? currentQuantity
                            : 0
                    ) - purchasedQuantity
                );

            if (remainingQuantity > 0) {
                batch.set(
                    cartDocument.ref,
                    {
                        productId:
                            cartDocument.id,
                        quantity:
                            remainingQuantity,
                        updatedAt:
                            new Date().toISOString()
                    }
                );
            } else {
                batch.delete(
                    cartDocument.ref
                );
            }

            changed = true;
        });

        if (activeAccountUid !== uid) {
            throw new Error(
                "The account changed before cart cleanup completed."
            );
        }

        if (changed) {
            await batch.commit();
        }

        markers[markerKey] = true;
        localStorage.setItem(
            completedCartCleanupKey,
            JSON.stringify(markers)
        );

        if (activeAccountUid === uid) {
            accountCart =
                accountCart.filter(function (item) {
                    const purchasedQuantity =
                        stagedQuantities.get(
                            item.id
                        ) || 0;
                    const remainingQuantity =
                        item.quantity -
                        purchasedQuantity;

                    if (remainingQuantity <= 0) {
                        return false;
                    }

                    item.quantity =
                        remainingQuantity;
                    return true;
                });

            updateHeaderCounts();
            renderCart();
        }
    }

    function showAccountDataError(error) {
        accountDataError =
            error instanceof Error
                ? error
                : new Error(String(error));

        console.error(
            "Account wishlist/cart synchronization failed:",
            accountDataError
        );

        const message =
            "Your saved wishlist and cart could not be synchronized. " +
            "Please check your connection and try again.";

        const errorElements =
            document.querySelectorAll(
                "#wishlistGrid, #cartItems"
            );

        errorElements.forEach(function (element) {
            element.innerHTML =
                `<div class="products-error">${message}</div>`;
        });

        if (typeof alert === "function") {
            alert(message);
        }
    }

    async function readAccountCollection(
        uid,
        collectionName
    ) {
        const modules =
            await getFirestoreModules();
        const firestore =
            modules.firestore;
        const firebase =
            modules.firebase;
        const snapshot =
            await firestore.getDocs(
                firestore.collection(
                    firebase.db,
                    ...getAccountCollectionPath(
                        uid,
                        collectionName
                    )
                )
            );

        return snapshot.docs.map(function (document) {
            const data =
                document.data();

            return {
                id: document.id,
                productId:
                    data.productId ||
                    document.id,
                quantity:
                    collectionName === "cart"
                        ? Number(data.quantity)
                        : 1
            };
        }).filter(function (item) {
            return item.productId &&
                (
                    collectionName !== "cart" ||
                    isPositiveInteger(item.quantity)
                );
        });
    }

    async function writeAccountCollection(
        uid,
        collectionName,
        items
    ) {
        const modules =
            await getFirestoreModules();
        const firestore =
            modules.firestore;
        const firebase =
            modules.firebase;
        const collectionReference =
            firestore.collection(
                firebase.db,
                ...getAccountCollectionPath(
                    uid,
                    collectionName
                )
            );
        const existing =
            await firestore.getDocs(
                collectionReference
            );
        const batch =
            firestore.writeBatch(firebase.db);
        const validItems =
            items.filter(function (item) {
                return item.id &&
                    (
                        collectionName !== "cart" ||
                        isPositiveInteger(
                            Number(item.quantity)
                        )
                    );
            });
        const validIds =
            new Set(
                validItems.map(item => item.id)
            );

        existing.forEach(function (document) {
            if (!validIds.has(document.id)) {
                batch.delete(document.ref);
            }
        });

        validItems.forEach(function (item) {
            const reference =
                firestore.doc(
                    firebase.db,
                    ...getAccountCollectionPath(
                        uid,
                        collectionName
                    ),
                    item.id
                );
            const data =
                collectionName === "cart"
                    ? {
                        productId: item.id,
                        quantity:
                            Number(item.quantity),
                        updatedAt:
                            new Date().toISOString()
                    }
                    : {
                        productId: item.id,
                        createdAt:
                            item.createdAt ||
                            new Date().toISOString()
                    };

            batch.set(reference, data);
        });

        await batch.commit();
    }

    async function persistAccountState() {
        if (
            !activeAccountUid ||
            !accountDataLoaded ||
            accountDataError
        ) {
            return;
        }

        const uid =
            activeAccountUid;
        const wishlist =
            accountWishlist.map(item => ({
                id: item.id,
                createdAt: item.createdAt
            }));
        const cart =
            accountCart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }));

        const previousPersistence =
            accountPersistencePromise ||
            Promise.resolve();
        accountPersistencePromise =
            previousPersistence
                .catch(function () {})
                .then(function () {
                    return Promise.all([
                        writeAccountCollection(
                            uid,
                            "wishlist",
                            wishlist
                        ),
                        writeAccountCollection(
                            uid,
                            "cart",
                            cart
                        )
                    ]);
                });

        try {
            await accountPersistencePromise;
        } finally {
            accountPersistencePromise = null;
        }
    }

    function resolveGuestItems(
        items,
        firestoreProducts
    ) {
        return items.map(function (item) {
            if (item.id) {
                return firestoreProducts.some(
                    product =>
                        product.id === item.id
                )
                    ? {
                        id: item.id,
                        quantity: item.quantity,
                        createdAt: item.createdAt
                    }
                    : null;
            }

            const matches =
                firestoreProducts.filter(
                    product =>
                        product.name === item.name
                );

            if (matches.length !== 1) {
                return null;
            }

            return {
                id: matches[0].id,
                quantity: item.quantity,
                createdAt: item.createdAt
            };
        }).filter(Boolean);
    }

    async function initializeAccountPersistence(user) {
        authStateKnown = true;
        activeAccountUid =
            user ? user.uid : null;
        accountDataLoaded = false;
        accountDataError = null;
        accountWishlist = [];
        accountCart = [];
        updateHeaderCounts();
        renderWishlist();
        renderCart();
        updateWishlistButtons();
        updateProductWishlistButton();

        if (!user) {
            return;
        }

        try {
            const remoteWishlist =
                await readAccountCollection(
                    user.uid,
                    "wishlist"
                );
            const remoteCart =
                await readAccountCollection(
                    user.uid,
                    "cart"
                );
            const firestoreProducts =
                await getAuthoritativeProducts();
            const guestWishlist =
                resolveGuestItems(
                    getStoredArray(guestWishlistKey),
                    firestoreProducts
                );
            const guestCart =
                resolveGuestItems(
                    getStoredArray(guestCartKey),
                    firestoreProducts
                );
            const wishlistIds =
                new Set(
                    remoteWishlist.map(
                        item => item.id
                    )
                );
            const mergedWishlist =
                remoteWishlist.concat(
                    guestWishlist.filter(
                        item => !wishlistIds.has(item.id)
                    )
                );
            const cartById =
                new Map(
                    remoteCart.map(item => [
                        item.id,
                        item
                    ])
                );

            guestCart.forEach(function (item) {
                const existing =
                    cartById.get(item.id);

                if (!existing) {
                    cartById.set(item.id, {
                        id: item.id,
                        quantity:
                            Number(item.quantity)
                    });
                } else {
                    existing.quantity =
                        Math.max(
                            existing.quantity,
                            Number(item.quantity)
                        );
                }
            });

            accountWishlist =
                mergedWishlist;
            accountCart =
                Array.from(cartById.values())
                    .filter(item =>
                        isPositiveInteger(
                            item.quantity
                        )
                    );
            accountDataLoaded = true;

            await persistAccountState();

            localStorage.removeItem(
                guestWishlistKey
            );
            localStorage.removeItem(
                guestCartKey
            );

            updateHeaderCounts();
            renderWishlist();
            renderCart();
            updateWishlistButtons();
            updateProductWishlistButton();
        } catch (error) {
            showAccountDataError(error);
            renderWishlist();
            renderCart();
            updateWishlistButtons();
            updateProductWishlistButton();
        }
    }

    function getAccountItems(collectionName) {
        if (!authStateKnown) {
            return getStoredArray(
                collectionName === "wishlist"
                    ? guestWishlistKey
                    : guestCartKey
            ).map(normalizeProduct);
        }

        if (!activeAccountUid) {
            return getStoredArray(
                collectionName === "wishlist"
                    ? guestWishlistKey
                    : guestCartKey
            ).map(normalizeProduct);
        }

        if (!accountDataLoaded || accountDataError) {
            return [];
        }

        return collectionName === "wishlist"
            ? accountWishlist.map(item => ({
                id: item.id,
                quantity: 1
            }))
            : accountCart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }));
    }

    function accountDataReadyForWrite() {
        if (
            !activeAccountUid ||
            (
                accountDataLoaded &&
                !accountDataError
            )
        ) {
            return true;
        }

        showAccountDataError(
            new Error(
                "Account data is still loading or unavailable."
            )
        );
        return false;
    }


/* =====================================================
   CORRECT PRODUCT DATA
===================================================== */

function getCorrectProduct(name) {
    return products.find(
        product => product.name === name
    );
}


function normalizeProduct(item) {
    return {
        id: item.id || "",
        name: item.name,

        price: Number(item.price),

        image: item.image,

        quantity:
    Number(item.quantity) || 1,

stock:
    Number.isFinite(
        Number(item.stock)
    )
        ? Number(item.stock)
        : Number.POSITIVE_INFINITY
    };
}

let authoritativeProductsPromise = null;

async function getAuthoritativeProducts() {
    if (!authoritativeProductsPromise) {
        authoritativeProductsPromise =
            Promise.all([
                import("./firebase.js"),
                import(
                    "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js"
                )
            ]).then(async function (modules) {
                const firebase =
                    modules[0];
                const firestore =
                    modules[1];
                const snapshot =
                    await firestore.getDocs(
                        firestore.collection(
                            firebase.db,
                            "products"
                        )
                    );

                return snapshot.docs
                    .map(function (productDocument) {
                        const data =
                            productDocument.data();

                        return {
                            id:
                                productDocument.id,
                            name:
                                data.name || "",
                            price:
                                Number(data.price),
                            image:
                                data.image || "",
                            stock:
                                Number.isFinite(
                                    Number(data.stock)
                                )
                                    ? Number(data.stock)
                                    : 0,
                            active:
                                data.active !== false
                        };
                    })
                    .filter(function (product) {
                        return product.active &&
                            product.name &&
                            Number.isFinite(
                                product.price
                            );
                    });
            }).catch(function (error) {
                authoritativeProductsPromise = null;
                throw error;
            });
    }

    return authoritativeProductsPromise;
}

async function resolveWishlistItems(items) {
    const firestoreProducts =
        await getAuthoritativeProducts();

    return items.map(function (item) {
        const idMatch = item.id
            ? firestoreProducts.find(
                product =>
                    product.id === item.id
            )
            : null;
        const nameMatches =
            item.name
                ? firestoreProducts.filter(
                    product =>
                        product.name === item.name
                )
                : [];
        const product =
            idMatch ||
            (
                !item.id &&
                nameMatches.length === 1
                    ? nameMatches[0]
                    : null
            );

        return product
            ? {
                ...item,
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                stock: product.stock,
                unavailable: false
            }
            : {
                ...item,
                unavailable: true
            };
    });
}


/* =====================================================
   OPEN PRODUCT PAGE
===================================================== */

function openProduct(
    name,
    price,
    image,
    stock,
    id = ""
) {
    const params = new URLSearchParams();

    if (id) {
        params.set("id", id);
    } else {
        params.set("name", name);
        params.set("price", price);
        params.set("image", image);
        params.set("stock", stock);
    }

    window.location.href =
        "product.html?" + params.toString();
}

function setProductActionsDisabled(disabled) {
    [
        "productBuyButton",
        "productCartButton",
        "productWishlistBtn",
        "productShareButton"
    ].forEach(function (id) {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = disabled;
        }
    });
}

function showProductUnavailable(message) {
    const nameElement = document.getElementById("productName");
    const priceElement = document.getElementById("productPrice");
    const stockElement = document.getElementById("productStockStatus");
    const descriptionElement =
        document.getElementById("productDescription");

    if (nameElement) {
        nameElement.textContent = "Product unavailable";
    }
    if (priceElement) {
        priceElement.textContent = "";
    }
    if (stockElement) {
        stockElement.textContent = message;
        stockElement.className =
            "product-stock-status out-of-stock";
    }
    if (descriptionElement) {
        descriptionElement.textContent =
            "This product is no longer available.";
    }
    setProductActionsDisabled(true);
}

function renderProductDetails(product) {
    const imageElement =
        document.getElementById(
            "productImage"
        );

    const name = product.name;
    const price = product.price;
    const image = product.image;
    const stock = product.stock;

    const nameElement =
        document.getElementById(
            "productName"
        );

    const priceElement =
        document.getElementById(
            "productPrice"
        );

    const stockElement =
        document.getElementById(
            "productStockStatus"
        );

    const buyButton =
        document.getElementById(
            "productBuyButton"
        );

    const cartButton =
        document.getElementById(
            "productCartButton"
        );
    const descriptionElement =
        document.getElementById("productDescription");

    if (nameElement) {
        nameElement.textContent = name;
    }


    if (priceElement) {
        priceElement.textContent =
            "₹" + price;
    }


    imageElement.src = image;
    imageElement.alt = name;

    if (descriptionElement) {
        descriptionElement.textContent =
            product.description ||
            "Handcrafted premium jewellery made with love and elegance.";
    }

    currentProductStock = stock;
    setProductActionsDisabled(false);

    /* PRODUCT STOCK STATUS */

    if (stockElement) {
        stockElement.className =
            "product-stock-status";

        if (stock <= 0) {
            stockElement.textContent =
                "Out of Stock";

            stockElement.classList.add(
                "out-of-stock"
            );

        } else if (stock <= 5) {
            stockElement.textContent =
                "Only " + stock + " left";

            stockElement.classList.add(
                "low-stock"
            );

        } else {
            stockElement.textContent =
                "In Stock";

            stockElement.classList.add(
                "in-stock"
            );
        }
    }


    /* DISABLE OUT-OF-STOCK PURCHASE */

    if (stock <= 0) {
        if (buyButton) {
            buyButton.disabled = true;
            buyButton.textContent =
                "Out of Stock";
        }

        if (cartButton) {
            cartButton.disabled = true;
            cartButton.textContent =
                "Unavailable";
        }
    }


    updateProductWishlistButton();
}

async function loadProductDetails() {
    const imageElement =
        document.getElementById("productImage");

    if (!imageElement) {
        return;
    }

    currentProduct = null;
    setProductActionsDisabled(true);

    const params =
        new URLSearchParams(window.location.search);
    const productId = params.get("id");

    if (!productId) {
        const legacyName = params.get("name");
        const legacyPrice = Number(params.get("price"));
        const legacyImage = params.get("image");
        const legacyStock = Number(params.get("stock"));

        if (
            !legacyName ||
            !Number.isFinite(legacyPrice) ||
            !legacyImage
        ) {
            showProductUnavailable(
                "This product link is incomplete."
            );
            return;
        }

        currentProduct = {
            id: "",
            name: legacyName,
            price: legacyPrice,
            image: legacyImage,
            stock: Number.isFinite(legacyStock)
                ? legacyStock
                : 0,
            description: ""
        };
        renderProductDetails(currentProduct);
        return;
    }

    try {
        const modules = await getFirestoreModules();
        const productReference =
            modules.firestore.doc(
                modules.firebase.db,
                "products",
                productId
            );
        const productSnapshot =
            await modules.firestore.getDoc(productReference);

        if (
            !productSnapshot.exists() ||
            productSnapshot.data().active === false
        ) {
            showProductUnavailable(
                "This product is no longer available."
            );
            return;
        }

        const data = productSnapshot.data();
        currentProduct = {
            id: productSnapshot.id,
            name: data.name || "Alora Jewellery",
            price: Number(data.price) || 0,
            image: data.image || "",
            stock: Number.isFinite(Number(data.stock))
                ? Number(data.stock)
                : 0,
            description: data.description || ""
        };
        renderProductDetails(currentProduct);
    } catch (error) {
        console.error("Product loading failed:", error);
        showProductUnavailable(
            "Unable to load this product. Please try again."
        );
    }
}

/* =====================================================
   QUANTITY
===================================================== */

function plus() {
    if (
        quantity < currentProductStock
    ) {
        quantity++;
        updateQuantity();

    } else {
        alert(
            "Only " +
            currentProductStock +
            " items are available."
        );
    }
}


function minus() {
    if (quantity > 1) {
        quantity--;
    }

    updateQuantity();
}


function updateQuantity() {
    const productCount =
        document.getElementById("count");

    const orderCount =
        document.getElementById("qty");

    if (productCount) {
        productCount.textContent =
            quantity;
    }

    if (orderCount) {
        orderCount.textContent =
            quantity;
    }

    updateOrderTotal();
}


/* =====================================================
   WISHLIST STORAGE
===================================================== */

function getWishlist() {
    return getAccountItems("wishlist");
}


function saveWishlist(wishlist) {
    if (activeAccountUid) {
        accountWishlist =
            wishlist.map(function (item) {
                return {
                    id: item.id,
                    createdAt:
                        item.createdAt
                };
            }).filter(item => item.id);

        persistAccountState()
            .catch(showAccountDataError);
        updateHeaderCounts();
        return;
    }

    localStorage.setItem(
        guestWishlistKey,
        JSON.stringify(wishlist)
    );

    updateHeaderCounts();
}


/* =====================================================
   WISHLIST MATCHING & SYNCHRONIZATION HELPERS
===================================================== */

function isMatchingWishlistItem(item, name, id) {
    if (!item || typeof item !== "object") {
        return false;
    }

    const targetId = id != null ? String(id).trim() : "";
    const targetName = name != null ? String(name).trim().toLowerCase() : "";
    const itemId = item.id != null ? String(item.id).trim() : "";
    const itemName = item.name != null ? String(item.name).trim().toLowerCase() : "";

    // 1. Direct ID match
    if (targetId && itemId && targetId === itemId) {
        return true;
    }

    // 2. Direct name match
    if (targetName && itemName && targetName === itemName) {
        return true;
    }

    // 3. Fallback matching through known product catalog
    const catalog = typeof products !== "undefined" && Array.isArray(products) ? products : [];

    if (targetId && itemName && !itemId) {
        const prod = catalog.find(p => p && String(p.id).trim() === targetId);
        if (prod && prod.name && prod.name.trim().toLowerCase() === itemName) {
            return true;
        }
    }

    if (targetName && itemId && !itemName) {
        const prod = catalog.find(p => p && String(p.id).trim() === itemId);
        if (prod && prod.name && prod.name.trim().toLowerCase() === targetName) {
            return true;
        }
    }

    // 4. Resolve targetName to ID or targetId to Name when item has the other attribute
    if (targetName && !targetId && itemId) {
        const prod = catalog.find(p => p && p.name && p.name.trim().toLowerCase() === targetName);
        if (prod && prod.id && String(prod.id).trim() === itemId) {
            return true;
        }
    }

    if (targetId && !targetName && itemName) {
        const prod = catalog.find(p => p && String(p.id).trim() === targetId);
        if (prod && prod.name && prod.name.trim().toLowerCase() === itemName) {
            return true;
        }
    }

    return false;
}

function isProductInWishlist(name, id) {
    const list = getWishlist();
    if (!Array.isArray(list) || list.length === 0) {
        return false;
    }
    return list.some(item => isMatchingWishlistItem(item, name, id));
}

if (typeof window !== "undefined") {
    window.isMatchingWishlistItem = isMatchingWishlistItem;
    window.isProductInWishlist = isProductInWishlist;
}


/* =====================================================
   TOGGLE WISHLIST
   HOME + COLLECTIONS
===================================================== */

function toggleWishlist(
    name,
    price,
    image,
    button,
    stock = Number.POSITIVE_INFINITY,
    id = ""
) {
    if (!accountDataReadyForWrite()) {
        return;
    }

    let wishlist = getWishlist();

    const existing = wishlist.some(
        item => isMatchingWishlistItem(item, name, id)
    );

    if (existing) {
        wishlist = wishlist.filter(
            item => !isMatchingWishlistItem(item, name, id)
        );
    } else {
        wishlist.push({
            name: name,
            id: id || "",
            price: Number(price),
            image: image,
            stock: Number(stock)
        });
    }

    saveWishlist(wishlist);

    const isNowActive = !existing;

    if (button) {
        button.classList.toggle("active", isNowActive);
        button.textContent = isNowActive ? "♥" : "♡";
        button.title = isNowActive ? "Remove from Wishlist" : "Add to Wishlist";
        button.setAttribute(
            "aria-label",
            (isNowActive ? "Remove " : "Add ") + (name || "product") + (isNowActive ? " from" : " to") + " wishlist"
        );
    }

    updateWishlistButtons();
    updateProductWishlistButton();
    renderWishlist();
}


/* =====================================================
   UPDATE HOME + COLLECTION HEARTS
===================================================== */

function updateWishlistButtons() {
    const wishlist = getWishlist();

    const buttons =
        document.querySelectorAll(
            ".wishlist-btn"
        );

    buttons.forEach(button => {
        const name = button.dataset.name;
        const id = button.dataset.id;

        if (!name && !id) {
            return;
        }

        const exists = wishlist.some(
            item => isMatchingWishlistItem(item, name, id)
        );

        button.classList.toggle(
            "active",
            exists
        );

        button.textContent =
            exists ? "♥" : "♡";

        button.title =
            exists ? "Remove from Wishlist" : "Add to Wishlist";

        button.setAttribute(
            "aria-label",
            (exists ? "Remove " : "Add ") + (name || "product") + (exists ? " from" : " to") + " wishlist"
        );
    });
}


/* =====================================================
   PRODUCT PAGE WISHLIST
===================================================== */

function toggleProductWishlist() {
    if (!accountDataReadyForWrite()) {
        return;
    }

    if (!currentProduct) {
        return;
    }

    const name = currentProduct.name;
    const price = currentProduct.price;
    const image = currentProduct.image;
    const id = currentProduct.id;
    const stock = currentProduct.stock;
    let wishlist = getWishlist();

    const existing = wishlist.some(
        item => isMatchingWishlistItem(item, name, id)
    );

    if (existing) {
        wishlist = wishlist.filter(
            item => !isMatchingWishlistItem(item, name, id)
        );
    } else {
        wishlist.push({
            name: name,
            id: id || "",
            price: Number(price),
            image: image,
            stock: Number(stock)
        });
    }

    saveWishlist(wishlist);

    updateProductWishlistButton();
    updateWishlistButtons();
    renderWishlist();
}


/* =====================================================
   PRODUCT WISHLIST BUTTON
===================================================== */

function updateProductWishlistButton() {
    const button =
        document.getElementById(
            "productWishlistBtn"
        );

    if (!button || !currentProduct) {
        return;
    }

    const name = currentProduct.name;
    const id = currentProduct.id;
    const exists = getWishlist().some(
        item => isMatchingWishlistItem(item, name, id)
    );

    button.classList.toggle(
        "active",
        exists
    );

    button.textContent = exists
        ? "♥ Wishlisted"
        : "♡ Wishlist";

    button.title = exists
        ? "Remove from Wishlist"
        : "Add to Wishlist";

    button.setAttribute(
        "aria-label",
        (exists ? "Remove " : "Add ") + (name || "product") + (exists ? " from" : " to") + " wishlist"
    );
}


/* =====================================================
   RENDER WISHLIST
===================================================== */

async function renderWishlist() {
    const grid =
        document.getElementById(
            "wishlistGrid"
        );

    const empty =
        document.getElementById(
            "emptyWishlist"
        );

    if (!grid) {
        return;
    }

    if (activeAccountUid && accountDataError) {
        grid.innerHTML =
            `<div class="products-error">Unable to load your saved wishlist. Please try again.</div>`;
        if (empty) {
            empty.style.display = "none";
        }
        return;
    }

    const wishlist = getWishlist();

    grid.innerHTML = "";

    if (wishlist.length === 0) {
        if (empty) {
            empty.style.display = "block";
        }

        return;
    }

    if (empty) {
        empty.style.display = "none";
    }

    let resolvedWishlist;

    try {
        resolvedWishlist =
            await resolveWishlistItems(
                wishlist
            );
    } catch (error) {
        grid.innerHTML = `
            <div class="products-error">
                <h2>Unable to Load Wishlist Prices</h2>
                <p>Please refresh and try again.</p>
            </div>
        `;
        console.error(
            "Wishlist products loading failed:",
            error
        );
        return;
    }

    resolvedWishlist.forEach(item => {
        const card =
            document.createElement("article");

        card.className = "wishlist-card";

        card.innerHTML = `
            <div class="wishlist-image">

                <img
                    src="${item.image}"
                    alt="${item.name}">

                <button
                    type="button"
                    class="wishlist-heart"
                    title="Remove from Wishlist"
                    aria-label="Remove ${item.name} from wishlist"
                    onclick="removeFromWishlist(
                        '${escapeQuotes(item.name)}',
                        '${escapeQuotes(item.id || "")}'
                    )">
                    ♥
                </button>

            </div>

            <div class="wishlist-card-content">

                <h3>${item.name}</h3>

                <p class="wishlist-price">
                    ${
                        item.unavailable
                            ? "Currently unavailable"
                            : "₹" + item.price
                    }
                </p>
                <p class="product-stock-status ${
    item.stock <= 0
        ? "out-of-stock"
        : item.stock <= 5
            ? "low-stock"
            : "in-stock"
}">
    ${
        item.unavailable
            ? "Price unavailable"
            : item.stock <= 0
            ? "Out of Stock"
            : item.stock <= 5
                ? "Only " + item.stock + " left"
                : "In Stock"
    }
</p>


                <div class="wishlist-actions">

                    <button
                        type="button"
                        class="wishlist-buy"
                        ${
                            item.unavailable ||
                            item.stock <= 0
                                ? "disabled"
                                : ""
                        }

                        onclick="buyNow(
                            '${escapeQuotes(item.name)}',
                            ${item.price}
                        )">
                        Buy Now
                    </button>

                    <button
                        type="button"
                        class="wishlist-cart"
                        ${
                            item.unavailable ||
                            item.stock <= 0
                                ? "disabled"
                                : ""
                        }
                       onclick="addToCart(
    '${escapeQuotes(item.name)}',
    ${item.price},
    '${escapeQuotes(item.image)}',
    1,
    ${item.stock},
    '${escapeQuotes(item.id || "")}'
)">
                        Add to Cart
                    </button>

                </div>

            </div>
        `;

        grid.appendChild(card);
    });
}
/* =====================================================
   REMOVE FROM WISHLIST
===================================================== */

function removeFromWishlist(name, id = "") {
    if (!accountDataReadyForWrite()) {
        return;
    }

    const wishlist = getWishlist().filter(
        item => !isMatchingWishlistItem(item, name, id)
    );

    saveWishlist(wishlist);

    renderWishlist();
    updateWishlistButtons();
    updateProductWishlistButton();
}


/* =====================================================
   CART STORAGE
===================================================== */

function getCart() {
    return getAccountItems("cart");
}


function saveCart(cart) {
    if (activeAccountUid) {
        accountCart =
            cart.map(function (item) {
                return {
                    id: item.id,
                    quantity:
                        Number(item.quantity)
                };
            }).filter(function (item) {
                return item.id &&
                    isPositiveInteger(
                        item.quantity
                    );
            });

        persistAccountState()
            .catch(showAccountDataError);
        updateHeaderCounts();
        return;
    }

    localStorage.setItem(
        guestCartKey,
        JSON.stringify(cart)
    );

    updateHeaderCounts();
}


/* =====================================================
   ADD TO CART
===================================================== */

function addToCart(
    name,
    price,
    image,
    qty = 1,
    stock = Number.POSITIVE_INFINITY,
    id = ""
) {
    if (!accountDataReadyForWrite()) {
        return;
    }

    const cart = getCart();

    const existing = cart.find(
        item =>
            (id && item.id === id) ||
            (!id && item.name === name)
    );

    const addedQuantity =
        Math.max(
            1,
            Number(qty) || 1
        );

    if (existing) {
        existing.quantity +=
            addedQuantity;

    } else {
        cart.push({
            name: name,
            id: id,
            price: Number(price),
            image: image,
            quantity: addedQuantity,
             stock: Number(stock)
        });
    }

    saveCart(cart);

    showCartMessage(name);
    renderCart();
}


/* =====================================================
   SHOW CART MESSAGE
===================================================== */

function showCartMessage(name) {
    const oldMessage =
        document.getElementById(
            "cartToast"
        );

    if (oldMessage) {
        oldMessage.remove();
    }

    const toast =
        document.createElement("div");

    toast.id = "cartToast";
    toast.className = "cart-toast";

    toast.innerHTML = `
        <div class="cart-toast-text">

            <span class="cart-toast-icon">
                ✓
            </span>

            <div>
                <strong>
                    Added to Cart
                </strong>

                <small>
                    ${name}
                </small>
            </div>

        </div>

        <a
            href="cart.html"
            class="cart-toast-link"
        >
            View Cart
        </a>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(function () {
        toast.classList.add("show");
    });

    setTimeout(function () {
        toast.classList.remove("show");

        setTimeout(function () {
            toast.remove();
        }, 300);

    }, 3500);
}


/* =====================================================
   ADD PRODUCT PAGE ITEM TO CART
===================================================== */
function addCurrentProductToCart() {
    if (!currentProduct) {
        return;
    }

    addToCart(
        currentProduct.name,
        currentProduct.price,
        currentProduct.image,
        quantity,
        currentProduct.stock,
        currentProduct.id
    );
}


/* =====================================================
   RENDER CART
===================================================== */

async function renderCart() {
    const container =
        document.getElementById(
            "cartItems"
        );

    if (!container) {
        return;
    }

    const empty =
        document.getElementById(
            "emptyCart"
        );

    const summary =
        document.getElementById(
            "cartSummary"
        );

    const totalElement =
        document.getElementById(
            "grandTotal"
        );

    const countElement =
        document.getElementById(
            "cartItemCount"
        );

    let cart = getCart();

    if (activeAccountUid) {
        if (!accountDataLoaded || accountDataError) {
            container.innerHTML =
                accountDataError
                    ? `<div class="products-error">Unable to load your saved cart. Please try again.</div>`
                    : "";
            if (empty) {
                empty.style.display =
                    accountDataError
                        ? "none"
                        : "block";
            }
            if (summary) {
                summary.style.display = "none";
            }
            return;
        }

        try {
            const resolved =
                await resolveWishlistItems(cart);

            cart = resolved
                .filter(item =>
                    !item.unavailable &&
                    item.stock > 0
                )
                .map(function (item) {
                    return {
                        ...item,
                        quantity: Math.min(
                            item.quantity,
                            item.stock
                        )
                    };
                });

            accountCart =
                cart.map(item => ({
                    id: item.id,
                    quantity: item.quantity
                }));
        } catch (error) {
            showAccountDataError(error);
            return;
        }
    }

    container.innerHTML = "";

    if (cart.length === 0) {
        if (empty) {
            empty.style.display =
                "block";
        }

        if (summary) {
            summary.style.display =
                "none";
        }

        if (countElement) {
            countElement.textContent =
                "0";
        }

        if (totalElement) {
            totalElement.textContent =
                "₹0";
        }

        return;
    }

    if (empty) {
        empty.style.display = "none";
    }

    if (summary) {
        summary.style.display = "block";
    }

    let total = 0;
    let totalItems = 0;

    cart.forEach((item, index) => {
        total +=
            item.price * item.quantity;

        totalItems += item.quantity;

        const cartItem =
            document.createElement(
                "article"
            );

        cartItem.className =
            "cart-item";

        cartItem.innerHTML = `
            <img
                src="${item.image}"
                alt="${item.name}"
            >

            <div class="cart-item-details">

                <h3>
                    ${item.name}
                </h3>

                <p class="cart-item-price">
                    ₹${item.price}
                </p>

                <div class="cart-controls">

                    <button
                        type="button"
                        onclick="changeCartQuantity(
                            ${index},
                            -1
                        )"
                        aria-label="Decrease ${item.name} quantity"
                    >
                        −
                    </button>

                    <span>
                        ${item.quantity}
                    </span>

                    <button
                        type="button"
                        onclick="changeCartQuantity(
                            ${index},
                            1
                        )"
                        aria-label="Increase ${item.name} quantity"
                    >
                        +
                    </button>

                </div>

            </div>

            <button
                type="button"
                class="remove-cart"
                onclick="removeFromCart(
                    ${index}
                )"
            >
                Remove
            </button>
        `;

        container.appendChild(
            cartItem
        );
    });

    if (totalElement) {
        totalElement.textContent =
            "₹" + total;
    }

    if (countElement) {
        countElement.textContent =
            totalItems;
    }
}


/* =====================================================
   CHANGE CART QUANTITY
===================================================== */
function changeCartQuantity(
    index,
    change
) {
    if (!accountDataReadyForWrite()) {
        return;
    }

    const cart = getCart();

    if (!cart[index]) {
        return;
    }

    const item = cart[index];

    const requestedQuantity =
        item.quantity + Number(change);


    /* DO NOT EXCEED AVAILABLE STOCK */

    if (
        Number(change) > 0 &&
        requestedQuantity > item.stock
    ) {
        alert(
            "Only " +
            item.stock +
            " items are available."
        );

        return;
    }


    item.quantity =
        requestedQuantity;


    if (item.quantity <= 0) {
        cart.splice(index, 1);
    }

    saveCart(cart);
    renderCart();
}


/* =====================================================
   REMOVE FROM CART
===================================================== */

function removeFromCart(index) {
    if (!accountDataReadyForWrite()) {
        return;
    }

    const cart = getCart();

    if (!cart[index]) {
        return;
    }

    cart.splice(index, 1);

    saveCart(cart);
    renderCart();
}


/* =====================================================
   BUY NOW
===================================================== */

function buyNow(name, price) {
    if (
        !name &&
        currentProduct
    ) {
        name = currentProduct.name;
        price = currentProduct.price;
    }

    if (!name) {
        const currentParams =
            new URLSearchParams(
                window.location.search
            );

        name =
            currentParams.get("name");

        price =
            Number(
                currentParams.get("price")
            );
    }

    if (!name || !price) {
        return;
    }

    localStorage.removeItem(
        "aloraCheckoutCart"
    );

    const params =
        new URLSearchParams();

    params.set("name", name);
    params.set("price", price);

    params.set(
        "quantity",
        quantity || 1
    );

    window.location.href =
        "order.html?" +
        params.toString();
}

function getCurrentProductUrl() {
    if (!currentProduct || !currentProduct.id) {
        return "";
    }

    const productUrl =
        new URL(
            "product.html",
            window.location.href
        );
    productUrl.search = "";
    productUrl.searchParams.set(
        "id",
        currentProduct.id
    );
    return productUrl.toString();
}

async function shareCurrentProduct() {
    const productUrl = getCurrentProductUrl();

    if (!productUrl || !currentProduct) {
        return;
    }

    const shareData = {
        title: currentProduct.name,
        text:
            "Discover " +
            currentProduct.name +
            " from Alora Handmade Jewelry.",
        url: productUrl
    };

    try {
        if (
            typeof navigator !== "undefined" &&
            typeof navigator.share === "function"
        ) {
            await navigator.share(shareData);
            return;
        }

        if (
            typeof navigator !== "undefined" &&
            navigator.clipboard &&
            typeof navigator.clipboard.writeText ===
            "function"
        ) {
            await navigator.clipboard.writeText(productUrl);
        } else {
            const input =
                document.createElement("textarea");
            input.value = productUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            input.remove();
        }

        const status =
            document.getElementById(
                "productShareStatus"
            );
        if (status) {
            status.textContent = "Product link copied";
        }
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error("Product sharing failed:", error);
        }
    }
}


/* =====================================================
   CHECKOUT CART
===================================================== */

async function checkoutCart() {
    let cart = getCart();

    if (cart.length === 0) {
        alert("Your cart is empty.");
        return;
    }

    if (activeAccountUid) {
        if (!accountDataLoaded || accountDataError) {
            showAccountDataError(
                new Error(
                    "Account cart is still loading or unavailable."
                )
            );
            return;
        }

        try {
            cart =
                (await resolveWishlistItems(cart))
                    .filter(function (item) {
                        return !item.unavailable &&
                            item.stock > 0;
                    })
                    .map(function (item) {
                        return {
                            id: item.id,
                            name: item.name,
                            price: item.price,
                            image: item.image,
                            stock: item.stock,
                            quantity: Math.min(
                                item.quantity,
                                item.stock
                            )
                        };
                    });
        } catch (error) {
            showAccountDataError(error);
            return;
        }

        if (cart.length === 0) {
            alert(
                "Your saved cart is unavailable. Please try again later."
            );
            return;
        }
    }

    localStorage.setItem(
        "aloraCheckoutCart",
        JSON.stringify(cart)
    );

    window.location.href =
        "order.html";
}


/* =====================================================
   LOAD ORDER PAGE
===================================================== */

function loadOrderPage() {
    const productName =
        document.getElementById(
            "productName"
        );

    const productPrice =
        document.getElementById(
            "productPrice"
        );

    const totalPrice =
        document.getElementById(
            "totalPrice"
        );

    if (
        !productName ||
        productName.tagName !== "INPUT" ||
        !productPrice
    ) {
        return;
    }

    const params =
        new URLSearchParams(
            window.location.search
        );

    const quantitySection =
        document.getElementById(
            "orderQuantitySection"
        );


    /* SINGLE PRODUCT ORDER */

    if (params.has("name")) {
        const name =
            params.get("name");

        const price =
            Number(
                params.get("price")
            );

        quantity = Math.max(
            1,
            Number(
                params.get("quantity")
            ) || 1
        );

        orderUnitPrice = price;
        isCartCheckout = false;

        productName.value = name;

        productPrice.value =
            "₹" + price;

        if (quantitySection) {
            quantitySection.style.display =
                "block";
        }

        updateQuantity();

        return;
    }


    /* CART CHECKOUT */

    const checkoutCartData =
        getStoredArray(
            "aloraCheckoutCart"
        ).map(normalizeProduct);

    if (
        checkoutCartData.length === 0
    ) {
        window.location.href =
            "cart.html";

        return;
    }

    isCartCheckout = true;

    const names =
        checkoutCartData
            .map(
                item =>
                    item.name +
                    " × " +
                    item.quantity
            )
            .join(", ");

    const total =
        checkoutCartData.reduce(
            (sum, item) =>
                sum +
                item.price *
                item.quantity,
            0
        );

    productName.value = names;

    productPrice.value =
        "₹" + total;

    if (totalPrice) {
        totalPrice.value =
            "₹" + total;
    }

    if (quantitySection) {
        quantitySection.style.display =
            "none";
    }

    updateUpiPaymentSection();
}


/* =====================================================
   UPDATE ORDER TOTAL
===================================================== */

function updateOrderTotal() {
    const totalInput =
        document.getElementById(
            "totalPrice"
        );

    if (
        !totalInput ||
        isCartCheckout
    ) {
        return;
    }

    if (orderUnitPrice > 0) {
        totalInput.value =
            "₹" +
            orderUnitPrice * quantity;
    }

    updateUpiPaymentSection();
}

function getCheckoutTotalAmount() {
    const totalInput =
        document.getElementById("totalPrice");
    const value =
        totalInput &&
        String(totalInput.value)
            .replace(/[^\d.]/g, "");
    const amount = Number(value);

    return Number.isFinite(amount) && amount > 0
        ? amount
        : 0;
}

function getUpiPaymentUri(amount) {
    if (!ALORA_UPI_ID || !amount) {
        return "";
    }

    const params = new URLSearchParams();
    params.set("pa", ALORA_UPI_ID);
    params.set("pn", "Alora");
    params.set("am", amount.toFixed(2));
    params.set("cu", "INR");

    return "upi://pay?" + params.toString();
}

function updateUpiPaymentSection() {
    const payment =
        document.getElementById("payment");
    const section =
        document.getElementById("upiPaymentSection");
    const unavailable =
        document.getElementById("upiPaymentUnavailable");
    const details =
        document.getElementById("upiPaymentDetails");
    const amountElement =
        document.getElementById("upiPaymentAmount");
    const qrCanvas =
        document.getElementById("upiQrCode");

    if (!payment || !section) {
        return;
    }

    const isOnline =
        payment.value === onlinePaymentMethod;
    section.hidden = !isOnline;

    if (!isOnline) {
        updatePlaceOrderAvailability();
        return;
    }

    const amount = getCheckoutTotalAmount();
    const uri = getUpiPaymentUri(amount);
    if (amountElement) {
        amountElement.textContent =
            "₹" + amount.toFixed(2);
    }

    if (!ALORA_UPI_ID || !uri || typeof QRCode === "undefined") {
        if (unavailable) {
            unavailable.hidden = false;
        }
        if (details) {
            details.hidden = true;
        }
        updatePlaceOrderAvailability();
        return;
    }

    if (unavailable) {
        unavailable.hidden = true;
    }
    if (details) {
        details.hidden = false;
    }

    QRCode.toCanvas(
        qrCanvas,
        uri,
        {
            width: 220,
            margin: 2
        },
        function (error) {
            if (error) {
                console.error("UPI QR generation failed:", error);
                if (unavailable) {
                    unavailable.hidden = false;
                }
                if (details) {
                    details.hidden = true;
                }
            }
        }
    );
    updatePlaceOrderAvailability();
}

function updatePlaceOrderAvailability() {
    const payment =
        document.getElementById("payment");
    const button =
        document.getElementById("placeOrderButton");
    const utr =
        document.getElementById("utr");

    if (!payment || !button) {
        return;
    }

    if (payment.value !== onlinePaymentMethod) {
        button.disabled = false;
        return;
    }

    button.disabled =
        !ALORA_UPI_ID ||
        typeof QRCode === "undefined" ||
        !utr ||
        !utr.value.trim() ||
        utr.value.trim().length > 100;
}

function setupPaymentSelection() {
    const payment =
        document.getElementById("payment");

    if (!payment) {
        return;
    }

    payment.addEventListener(
        "change",
        function () {
            updateUpiPaymentSection();
            updatePlaceOrderAvailability();
        }
    );
    const utr = document.getElementById("utr");
    if (utr) {
        utr.addEventListener(
            "input",
            updatePlaceOrderAvailability
        );
    }
    updateUpiPaymentSection();
}
/* =====================================================
   MY ORDERS STORAGE
===================================================== */

function getMyOrders() {
    return getStoredArray(
        "aloraMyOrders"
    );
}


function saveMyOrders(orders) {
    localStorage.setItem(
        "aloraMyOrders",
        JSON.stringify(orders)
    );
}


/* =====================================================
   SAVE NEW ORDER
===================================================== */

function saveOrderToHistory(
    orderDetails
) {
    const orders = getMyOrders();

    orders.unshift(orderDetails);

    saveMyOrders(orders);
}


/* =====================================================
   RENDER MY ORDERS
===================================================== */

function renderMyOrders() {
    const ordersList =
        document.getElementById(
            "ordersList"
        );

    const emptyOrders =
        document.getElementById(
            "emptyOrders"
        );

    if (!ordersList) {
        return;
    }

    const orders = getMyOrders();

    ordersList.innerHTML = "";


    /* NO ORDERS */

    if (orders.length === 0) {
        if (emptyOrders) {
            emptyOrders.style.display =
                "block";
        }

        return;
    }


    if (emptyOrders) {
        emptyOrders.style.display =
            "none";
    }


    /* CREATE ORDER CARDS */

    orders.forEach(order => {
        const orderCard =
            document.createElement(
                "article"
            );

        orderCard.className =
            "order-history-card";

        orderCard.innerHTML = `
            <div class="order-history-header">

                <div>

                    <h3>
                        Order #${escapeHTML(order.id)}
                    </h3>

                    <p class="order-history-date">
                        ${escapeHTML(order.date)}
                    </p>

                </div>

                <span class="order-status">
                    ${escapeHTML(order.status)}
                </span>

            </div>


            <div class="order-history-body">

                <div class="order-history-info">

                    <span>PRODUCTS</span>

                    <strong>
                        ${escapeHTML(order.products)}
                    </strong>

                </div>


                <div class="order-history-info">

                    <span>QUANTITY</span>

                    <strong>
                        ${order.quantity}
                    </strong>

                </div>


                <div class="order-history-info">

                    <span>PAYMENT METHOD</span>

                    <strong>
                        ${escapeHTML(order.payment)}
                    </strong>

                </div>


                <div class="order-history-info">

                    <span>CUSTOMER</span>

                    <strong>
                        ${escapeHTML(order.customer)}
                    </strong>

                </div>

            </div>


            <div class="order-history-footer">

                <span>
                    Order Total
                </span>

                <strong class="order-history-total">
                    ${escapeHTML(order.total)}
                </strong>

            </div>
        `;

        ordersList.appendChild(
            orderCard
        );
    });
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   PLACE ORDER → GOOGLE FORM / GOOGLE SHEET
===================================================== */

const ALORA_PRODUCTION_URL = "https://alora-handmade-jewelry.web.app";

function buildAdminOrderUrl(orderId, userId) {
    const baseUrl = typeof ALORA_PRODUCTION_URL !== "undefined"
        ? ALORA_PRODUCTION_URL
        : "https://alora-handmade-jewelry.web.app";

    const adminUrl =
        new URL(
            "admin.html",
            baseUrl
        );

    adminUrl.search = "";
    if (orderId) {
        adminUrl.searchParams.set(
            "orderId",
            String(orderId).trim()
        );
    }
    if (userId) {
        adminUrl.searchParams.set(
            "userId",
            String(userId).trim()
        );
    }

    return adminUrl.toString();
}

async function placeOrder() {
    if (
        placeOrderInFlight ||
        placeOrderCompleted
    ) {
        return;
    }

    const customerName =
        document.getElementById(
            "customerName"
        );

    const phone =
        document.getElementById(
            "phone"
        );

    const email =
        document.getElementById(
            "email"
        );

    const address =
        document.getElementById(
            "address"
        );

    const productName =
        document.getElementById(
            "productName"
        );

    const productPrice =
        document.getElementById(
            "productPrice"
        );

    const payment =
        document.getElementById(
            "payment"
        );
    const utrInput =
        document.getElementById("utr");

    const placeOrderButton =
        document.querySelector(
            ".place-order"
        );


    /* REQUIRED FIELD VALIDATION */

    if (
        !customerName ||
        !phone ||
        !address ||
        !productName ||
        !productPrice ||
        !payment
    ) {
        return;
    }


    if (
        customerName.value.trim() === "" ||
        phone.value.trim() === "" ||
        address.value.trim() === ""
    ) {
        alert(
            "Please fill all required details."
        );

        return;
    }


    /* PHONE VALIDATION */

    if (
        !/^[0-9]{10}$/.test(
            phone.value.trim()
        )
    ) {
        alert(
            "Please enter a valid 10-digit phone number."
        );

        return;
    }

    placeOrderInFlight = true;

    if (placeOrderButton) {
        placeOrderButton.disabled =
            true;

        placeOrderButton.textContent =
            "Submitting Order...";
    }


    try {
        const isOnlinePayment =
            payment.value === onlinePaymentMethod;
        const utr =
            utrInput
                ? utrInput.value.trim()
                : "";

        if (isOnlinePayment) {
            if (
                !ALORA_UPI_ID ||
                typeof QRCode === "undefined"
            ) {
                throw new Error(
                    "Online payment is temporarily unavailable."
                );
            }

            if (!utr || utr.length > 100) {
                throw new Error(
                    "Please enter a valid UPI Transaction ID / UTR."
                );
            }
        }

        /* QUANTITY */

        let orderQuantity = quantity;
        const cartCheckoutSnapshot =
            isCartCheckout
                ? getStoredArray(
                    "aloraCheckoutCart"
                )
                : [];

        if (isCartCheckout) {
            orderQuantity =
                cartCheckoutSnapshot.reduce(
                    (total, item) =>
                        total +
                        (
                            Number(
                                item.quantity
                            ) || 1
                        ),
                    0
                );
        }


        /* GOOGLE FORM DATA */

        const formData =
            new FormData();

        formData.append(
            "entry.635724047",
            productName.value
        );

        formData.append(
            "entry.1549377455",
            productPrice.value
        );

        formData.append(
            "entry.22862365",
            orderQuantity
        );

        formData.append(
            "entry.2082653463",
            customerName.value.trim()
        );

        formData.append(
            "entry.553681485",
            phone.value.trim()
        );

        formData.append(
            "entry.1147646603",
            email
                ? email.value.trim()
                : ""
        );

        formData.append(
            "entry.343072486",
            address.value.trim()
        );

        formData.append(
            "entry.2064511199",
            payment.value
        );


        const formURL =
            "https://docs.google.com/forms/u/0/d/e/1FAIpQLSfU9gMTw8VcAI7Z1fT3cKWbYqbBVLOWQGGqfkTzQINrxbc2Fw/formResponse";

        /* SAVE ORDER IN MY ORDERS */

        const totalPriceElement =
            document.getElementById(
                "totalPrice"
            );

        const orderId =
            "ALR-" +
            Date.now()
                .toString()
                .slice(-8);

        const orderDate =
            new Date().toLocaleString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );


        /* DELIVERY DATE: 7–10 DAYS */

        const orderCreatedDate =
            new Date();


        const deliveryStartDate =
            new Date(
                orderCreatedDate
            );

        deliveryStartDate.setDate(
            deliveryStartDate.getDate() +
            7
        );


        const deliveryEndDate =
            new Date(
                orderCreatedDate
            );

        deliveryEndDate.setDate(
            deliveryEndDate.getDate() +
            10
        );
/* ORDER ITEMS FOR STOCK UPDATE */

const orderItems =
    isCartCheckout
        ? cartCheckoutSnapshot.map(item => ({
            id: item.id || "",
            name: item.name,
            quantity:
                Number(item.quantity) || 1
        }))
        : [
            {
                name:
                    productName.value,

                quantity:
                    orderQuantity
            }
        ];

        /* CREATE ORDER */

        const newOrder = {
            id: orderId,

            products:
                productName.value,

            quantity:
                orderQuantity,
            items:
                orderItems,

            total:
                totalPriceElement
                    ? totalPriceElement.value
                    : productPrice.value,

            payment:
                payment.value,

            utr:
                isOnlinePayment
                    ? utr
                    : "",

            customer:
                customerName.value.trim(),

            phone:
                phone.value.trim(),

            email:
                email
                    ? email.value.trim()
                    : "",

            address:
                address.value.trim(),

            date:
                orderDate,

            status:
                "Order Received",

            estimatedDeliveryStart:
                deliveryStartDate
                    .toISOString(),

            estimatedDeliveryEnd:
                deliveryEndDate
                    .toISOString()
        };


        /* FIRESTORE SAVE IS REQUIRED */

        if (
            typeof window
                .saveOrderToFirestore !==
            "function"
        ) {
            throw new Error(
                "Order service is unavailable. Your order was not saved."
            );
        }

        const orderAccountUid =
            activeAccountUid;

        await window
            .saveOrderToFirestore(
                newOrder
            );

        const adminOrderUrl =
            buildAdminOrderUrl(
                orderId,
                orderAccountUid
            );

        placeOrderCompleted = true;

        /* AUTOMATIC ORDER EMAIL NOTIFICATIONS (ADMIN + CUSTOMER) */

        const dispatchOrderEmails =
            typeof window !== "undefined" &&
            typeof window.sendOrderEmails === "function"
                ? window.sendOrderEmails
                : (typeof window !== "undefined" &&
                   typeof window.sendAdminOrderNotificationEmail === "function"
                    ? window.sendAdminOrderNotificationEmail
                    : (typeof sendOrderEmails === "function"
                        ? sendOrderEmails
                        : (typeof sendAdminOrderNotificationEmail === "function"
                            ? sendAdminOrderNotificationEmail
                            : null)));

        if (typeof dispatchOrderEmails === "function") {
            Promise.resolve()
                .then(function () {
                    return dispatchOrderEmails(
                        newOrder,
                        adminOrderUrl
                    );
                })
                .catch(function (emailError) {
                    console.error(
                        "Automatic order email notification failed:",
                        emailError
                    );
                });
        }

        let cartCleanupFailed = false;

        if (
            isCartCheckout &&
            orderAccountUid
        ) {
            try {
                await cleanupPurchasedAccountCart(
                    orderAccountUid,
                    orderId,
                    cartCheckoutSnapshot
                );
            } catch (cleanupError) {
                cartCleanupFailed = true;
                console.error(
                    "Cart cleanup failed after order was saved:",
                    cleanupError
                );
                alert(
                    "Your order was placed successfully, but your cart could not be updated. " +
                    "Please refresh the cart before placing another order."
                );
            }
        }


        /* SECONDARY LOCAL HISTORY SAVE */

        try {
            saveOrderToHistory(
                newOrder
            );
        } catch (historyError) {
            console.error(
                "Local order history save failed after Firestore save:",
                historyError
            );
        }


        /* CLEAR LOCAL CHECKOUT DATA AFTER FIRESTORE SAVE */

        try {
            if (isCartCheckout) {
                localStorage.removeItem(
                    "aloraCart"
                );
            }

            localStorage.removeItem(
                "aloraCheckoutCart"
            );
        } catch (storageError) {
            console.error(
                "Local checkout cleanup failed after Firestore save:",
                storageError
            );
        }


        /* SECONDARY GOOGLE FORM SUBMISSION */

        /*
         * no-cors only tells us the request resolved locally;
         * it does not verify Google accepted the submission.
         */
        Promise.resolve()
            .then(function () {
                return fetch(
                    formURL,
                    {
                        method: "POST",
                        mode: "no-cors",
                        body: formData
                    }
                );
            })
            .catch(function (formError) {
                console.error(
                    "Google Form submission failed after Firestore save:",
                    formError
                );
            });


        /* SUCCESS BUTTON */

        if (placeOrderButton) {
            placeOrderButton.textContent =
                cartCleanupFailed
                    ? "✓ Order Placed (Cart Update Needed)"
                    : "✓ Order Placed Successfully";

            placeOrderButton.classList.add(
                "order-success"
            );
        }


        /* RETURN HOME */

        setTimeout(function () {
            window.location.href =
                "index.html";
        }, 1800);


    } catch (error) {

        if (placeOrderButton) {
            placeOrderButton.textContent =
                "Place Order";
        }

        updatePlaceOrderAvailability();

        alert(
            error.message ||
            "Order could not be saved. Your checkout data is still available."
        );
    } finally {
        placeOrderInFlight = false;
    }
}
/* =====================================================
   CONTACT FORM
===================================================== */

function sendMessage(event) {
    event.preventDefault();

    if (contactMessageInFlight) {
        return;
    }

    const form =
        event.target;
    const statusElement =
        document.getElementById(
            "contactMessage"
        );
    const submitButton =
        form &&
        form.querySelector(
            "button[type='submit']"
        );
    const nameElement =
        document.getElementById(
            "name"
        );

    if (!nameElement) {
        return;
    }

    const emailElement =
        document.getElementById("email");
    const subjectElement =
        document.getElementById("subject");
    const messageElement =
        document.getElementById("message");
    const setStatus =
        function (message, type) {
            if (statusElement) {
                statusElement.textContent = message;
                statusElement.className =
                    "contact-message " +
                    (type || "");
            }
        };

    if (!contactAuthUser) {
        setStatus(
            "Please log in before sending a message. You can still contact us through WhatsApp or email.",
            "error"
        );
        return;
    }

    const values = {
        name: nameElement.value.trim(),
        email: emailElement.value.trim(),
        subject: subjectElement.value.trim(),
        message: messageElement.value.trim()
    };

    if (
        !values.name ||
        !values.email ||
        !values.subject ||
        !values.message ||
        values.name.length > 100 ||
        values.email.length > 254 ||
        values.subject.length > 150 ||
        values.message.length > 2000 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            values.email
        )
    ) {
        setStatus(
            "Please check your name, email, subject, and message. Keep the message under 2000 characters.",
            "error"
        );
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
    }
    contactMessageInFlight = true;

    getFirestoreModules()
        .then(function (modules) {
            return modules.firestore.addDoc(
                modules.firestore.collection(
                    modules.firebase.db,
                    "contactMessages"
                ),
                {
                    userId: contactAuthUser.uid,
                    name: values.name,
                    email: values.email,
                    subject: values.subject,
                    message: values.message,
                    status: "New",
                    createdAt:
                        modules.firestore.serverTimestamp()
                }
            );
        })
        .then(function () {
            setStatus(
                "Your message was sent successfully.",
                "success"
            );
            form.reset();
        })
        .catch(function (error) {
            console.error(
                "Contact message save failed:",
                error
            );
            setStatus(
                "We could not save your message. Please try again.",
                "error"
            );
        })
        .finally(function () {
            contactMessageInFlight = false;
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent =
                    "Send Message";
            }
        });
}


/* =====================================================
   LIVE SEARCH
===================================================== */

function setupSearch() {
    const search =
        document.getElementById(
            "search"
        );

    if (!search) {
        return;
    }

    search.addEventListener(
        "input",
        function () {
            const value =
                search.value
                    .toLowerCase()
                    .trim();

            const cards =
                document.querySelectorAll(
                    ".card"
                );

            cards.forEach(card => {
                const heading =
                    card.querySelector(
                        "h3"
                    );

                const name = heading
                    ? heading.textContent
                        .toLowerCase()
                    : "";

                card.style.display =
                    name.includes(value)
                        ? ""
                        : "none";
            });
        }
    );
}


/* =====================================================
   ESCAPE QUOTES
===================================================== */

function escapeQuotes(text) {
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}


/* =====================================================
   CLOSE MOBILE MENU
===================================================== */

function setupMobileMenu() {
    const nav =
        document.getElementById(
            "navMenu"
        );
    const toggleBtn =
        typeof document.querySelector === "function"
            ? document.querySelector(".menu-toggle")
            : null;

    if (!nav) {
        return;
    }

    if (typeof nav.querySelectorAll === "function") {
        nav
            .querySelectorAll("a")
            .forEach(link => {
                link.addEventListener(
                    "click",
                    function () {
                        nav.classList.remove(
                            "active"
                        );
                        if (toggleBtn && typeof toggleBtn.setAttribute === "function") {
                            toggleBtn.setAttribute("aria-expanded", "false");
                        }
                    }
                );
            });
    }

    if (typeof document.addEventListener === "function") {
        document.addEventListener("click", function (event) {
            if (!nav.classList || !nav.classList.contains("active")) {
                return;
            }

            if (
                typeof nav.contains === "function" &&
                !nav.contains(event.target) &&
                (!toggleBtn || (typeof toggleBtn.contains === "function" && !toggleBtn.contains(event.target)))
            ) {
                nav.classList.remove("active");
                if (toggleBtn && typeof toggleBtn.setAttribute === "function") {
                    toggleBtn.setAttribute("aria-expanded", "false");
                }
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && nav.classList && nav.classList.contains("active")) {
                nav.classList.remove("active");
                if (toggleBtn && typeof toggleBtn.setAttribute === "function") {
                    toggleBtn.setAttribute("aria-expanded", "false");
                }
            }
        });
    }
}


/* =====================================================
   HEADER COUNTS
===================================================== */

function updateHeaderCounts() {
    const wishlistCount =
        getWishlist().length;

    const cartCount =
        getCart().reduce(
            (total, item) =>
                total + item.quantity,
            0
        );

    updateCountBadge(
        "wishlistCountBadge",
        wishlistCount
    );

    updateCountBadge(
        "cartCountBadge",
        cartCount
    );
}


function updateCountBadge(
    badgeId,
    count
) {
    const badge =
        document.getElementById(
            badgeId
        );

    if (!badge) {
        return;
    }

    badge.textContent = count;

    badge.style.display =
        count > 0
            ? "inline-flex"
            : "none";
}


/* =====================================================
   ACCOUNT DROPDOWN
===================================================== */

function toggleAccountMenu(event) {
    event.stopPropagation();

    const dropdown =
        document.getElementById(
            "accountDropdown"
        );

    if (dropdown) {
        dropdown.classList.toggle(
            "active"
        );
    }
}


function setupAccountMenu() {
    document.addEventListener(
        "click",
        function () {
            const dropdown =
                document.getElementById(
                    "accountDropdown"
                );

            if (dropdown) {
                dropdown.classList.remove(
                    "active"
                );
            }
        }
    );
}


/* =====================================================
   PAGE LOAD
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {
        getFirestoreModules()
            .then(function (modules) {
                return import(
                    "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js"
                ).then(function (authModule) {
                    authModule.onAuthStateChanged(
                        modules.firebase.auth,
                        async function (user) {
                            contactAuthUser = user;
                            initializeAccountPersistence(
                                user
                            );

                            if (
                                user &&
                                user.email &&
                                user.email.trim().toLowerCase() === "alorajewels26@gmail.com"
                            ) {
                                try {
                                    const pathSegments = window.location.pathname.split("/");
                                    const pageName = pathSegments.pop() || "index.html";

                                    if (pageName.includes("login.html") || pageName.includes("profile.html") || pageName.includes("admin.html")) {
                                        return;
                                    }

                                    const urlParams =
                                        new URLSearchParams(
                                            window.location.search
                                        );
                                    const isStorefrontPreview =
                                        urlParams.get("view") === "storefront";

                                    if (isStorefrontPreview) {
                                        console.log(
                                            "[ALORA AUTH DEBUG]",
                                            {
                                                currentPage: pageName,
                                                file: "script.js",
                                                function: "onAuthStateChanged",
                                                email: user.email,
                                                uid: user.uid,
                                                docExists: true,
                                                firestoreRole: "admin",
                                                normalizedRole: "admin",
                                                chosenRedirectTarget: "stay on storefront"
                                            }
                                        );
                                        return;
                                    }

                                    const userReference =
                                        modules.firestore.doc(
                                            modules.firebase.db,
                                            "users",
                                            user.uid
                                        );
                                    let userSnapshot =
                                        await modules.firestore.getDoc(
                                            userReference
                                        );

                                    let matchedDoc =
                                        (userSnapshot && typeof userSnapshot.exists === "function" && userSnapshot.exists())
                                            ? userSnapshot
                                            : null;

                                    if (!matchedDoc) {
                                        try {
                                            const emailRef = modules.firestore.doc(modules.firebase.db, "users", user.email.trim().toLowerCase());
                                            const emailSnap = await modules.firestore.getDoc(emailRef);
                                            if (emailSnap && typeof emailSnap.exists === "function" && emailSnap.exists()) {
                                                matchedDoc = emailSnap;
                                            }
                                        } catch (_) {}

                                        if (!matchedDoc) {
                                            try {
                                                const adminUidRef = modules.firestore.doc(modules.firebase.db, "admins", user.uid);
                                                const adminUidSnap = await modules.firestore.getDoc(adminUidRef);
                                                if (adminUidSnap && typeof adminUidSnap.exists === "function" && adminUidSnap.exists()) {
                                                    matchedDoc = adminUidSnap;
                                                }
                                            } catch (_) {}
                                        }
                                    }

                                    const exists = Boolean(matchedDoc && typeof matchedDoc.exists === "function" && matchedDoc.exists());
                                    const data = exists ? (matchedDoc.data() || {}) : {};
                                    const rawRole = data.role !== undefined ? data.role : data.Role;

                                    function extractRole(d) {
                                        if (!d) return "";
                                        const raw = d.role !== undefined ? d.role : d.Role;
                                        if (typeof raw === "string") return raw.trim().toLowerCase();
                                        if (d.isAdmin === true || d.isAdmin === "true" || d.isAdmin === "admin") return "admin";
                                        if (d.admin === true || d.admin === "true") return "admin";
                                        if (raw === true) return "admin";
                                        if (Array.isArray(d.roles) && d.roles.some(r => typeof r === "string" && r.trim().toLowerCase() === "admin")) return "admin";
                                        if (d.roles && typeof d.roles === "object" && d.roles.admin === true) return "admin";
                                        if (typeof d.type === "string" && d.type.trim().toLowerCase() === "admin") return "admin";
                                        if (typeof d.accountType === "string" && d.accountType.trim().toLowerCase() === "admin") return "admin";
                                        return "";
                                    }

                                    const normalizedRole = extractRole(data);
                                    const isRoleAdmin = exists && normalizedRole === "admin";

                                    const storedReturn = sessionStorage.getItem("aloraReturnUrl");
                                    const adminTarget = (storedReturn && storedReturn.toLowerCase().includes("admin.html"))
                                        ? storedReturn
                                        : "admin.html";

                                    console.log(
                                        "[ALORA AUTH DEBUG]",
                                        {
                                            currentPage: pageName,
                                            file: "script.js",
                                            function: "onAuthStateChanged",
                                            email: user.email,
                                            uid: user.uid,
                                            docExists: exists,
                                            firestoreRole: rawRole !== undefined && rawRole !== null ? rawRole : "(undefined)",
                                            normalizedRole,
                                            chosenRedirectTarget: adminTarget
                                        }
                                    );

                                    sessionStorage.removeItem("aloraReturnUrl");
                                    window.location.replace(adminTarget);
                                    return;
                                } catch (error) {
                                    console.error("[ALORA AUTH DEBUG] Storefront admin check error:", error);
                                }
                            }

                        }
                    );

                });
            })
            .catch(function (error) {
                showAccountDataError(error);
            });

        setupMobileMenu();
        setupAccountMenu();
        setupSearch();
        setupPaymentSelection();

        loadProductDetails();
        loadOrderPage();

        renderWishlist();
        renderCart();
        renderMyOrders();

        updateWishlistButtons();
        updateProductWishlistButton();
        updateHeaderCounts();
        trackPageView();
    }
);


/* =====================================================
   CROSS-PAGE & STORAGE SYNCHRONIZATION
===================================================== */

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pageshow", function () {
        updateHeaderCounts();
        updateWishlistButtons();
        updateProductWishlistButton();
        renderWishlist();
    });

    window.addEventListener("storage", function (event) {
        if (event.key === guestWishlistKey || event.key === "aloraWishlist") {
            updateHeaderCounts();
            updateWishlistButtons();
            updateProductWishlistButton();
            renderWishlist();
        }
    });
}


/* =====================================================
   GOOGLE / FIREBASE ANALYTICS PAGE TRACKING
===================================================== */

async function trackPageView() {
    try {
        if (typeof window === "undefined" || !window.location) {
            return;
        }

        const pathname = window.location.pathname || "";
        if (pathname.endsWith("admin.html") || pathname.includes("/admin")) {
            return;
        }

        const firebaseModule = await import("./firebase.js");
        if (typeof firebaseModule.initAnalytics === "function") {
            const analyticsInstance = await firebaseModule.initAnalytics();
            if (analyticsInstance) {
                const analyticsSdk = await import(
                    "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js"
                );
                if (typeof analyticsSdk.logEvent === "function") {
                    analyticsSdk.logEvent(analyticsInstance, "page_view", {
                        page_title: document.title || "Alora Handmade Jewelry",
                        page_location: window.location.href,
                        page_path: pathname
                    });
                }
            }
        }
    } catch (error) {
        // Safe silent fallback so analytics never disrupts storefront
    }
}