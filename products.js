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

                description:
                    product.description ||
                    "Handcrafted Alora jewellery."
            });
        });


        /* NEW PRODUCTS FIRST */

        firestoreProducts.reverse();


        renderProducts(firestoreProducts);

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