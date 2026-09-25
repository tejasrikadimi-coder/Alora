const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "script.js"),
    "utf8"
);

function extractFunction(name) {
    const asyncStart =
        source.indexOf(`async function ${name}`);
    const start =
        asyncStart >= 0
            ? asyncStart
            : source.indexOf(`function ${name}`);
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

const elements = new Map();
[
    "productImage",
    "productName",
    "productPrice",
    "productStockStatus",
    "productDescription",
    "productBuyButton",
    "productCartButton",
    "productWishlistBtn",
    "productShareButton",
    "productShareStatus"
].forEach((id) => {
    elements.set(id, {
        disabled: false,
        textContent: "",
        className: "",
        src: "",
        alt: ""
    });
});

const product = {
    name: "Firestore Necklace",
    price: 1499,
    image: "necklace.jpg",
    stock: 3,
    description: "Authoritative description",
    active: true
};

const context = vm.createContext({
    URL,
    URLSearchParams,
    console,
    window: {
        location: {
            search:
                "?id=stable-product-id&name=Stale&price=1&image=stale.jpg",
            href: "https://alora.example/product.html"
        }
    },
    document: {
        getElementById(id) {
            return elements.get(id) || null;
        }
    },
    currentProduct: null,
    currentProductStock: Number.POSITIVE_INFINITY,
    getFirestoreModules: async () => ({
        firebase: {db: {}},
        firestore: {
            doc(_db, ...path) {
                return {path};
            },
            async getDoc(reference) {
                assert.deepEqual(
                    reference.path,
                    ["products", "stable-product-id"]
                );
                return {
                    id: "stable-product-id",
                    exists: () => true,
                    data: () => product
                };
            }
        }
    }),
    setProductActionsDisabled() {},
    renderProductDetails(loadedProduct) {
        context.renderedProduct = loadedProduct;
    },
    showProductUnavailable(message) {
        context.unavailableMessage = message;
    }
});

vm.runInContext(
    extractFunction("loadProductDetails"),
    context
);

(async function run() {
    await vm.runInContext(
        "loadProductDetails()",
        context
    );

    assert.equal(
        context.renderedProduct.id,
        "stable-product-id"
    );
    assert.equal(
        context.renderedProduct.price,
        1499
    );
    assert.equal(
        context.renderedProduct.name,
        "Firestore Necklace"
    );
    console.log(
        "PASS product ID loads authoritative Firestore data over stale URL fields"
    );

    context.window.location.search =
        "?id=stable-product-id";
    await vm.runInContext(
        "loadProductDetails()",
        context
    );
    console.log(
        "PASS product ID loading works without legacy URL fields or localStorage"
    );

    const shareContext = vm.createContext({
        URL,
        currentProduct: {
            id: "stable-product-id",
            name: "Firestore Necklace"
        },
        window: {
            location: {
                href: "https://alora.example/product.html"
            }
        }
    });
    vm.runInContext(
        extractFunction("getCurrentProductUrl"),
        shareContext
    );
    assert.equal(
        vm.runInContext(
            "getCurrentProductUrl()",
            shareContext
        ),
        "https://alora.example/product.html?id=stable-product-id"
    );
    console.log(
        "PASS canonical share URL contains only the stable product ID"
    );

    const actionContext = vm.createContext({
        URLSearchParams,
        currentProduct: context.renderedProduct,
        quantity: 2,
        accountDataReadyForWrite: () => true,
        getWishlist: () => [],
        saveWishlist(wishlist) {
            actionContext.savedWishlist = wishlist;
        },
        updateProductWishlistButton() {},
        updateWishlistButtons() {},
        renderWishlist() {},
        addToCart(...args) {
            actionContext.cartArgs = args;
        },
        localStorage: {
            removeItem() {}
        },
        window: {
            location: {
                search: "?id=stable-product-id",
                href: "https://alora.example/product.html"
            }
        },
        document: {
            getElementById() {
                return null;
            }
        }
    });
    vm.runInContext(
        extractFunction("toggleProductWishlist") +
        extractFunction("addCurrentProductToCart") +
        extractFunction("buyNow"),
        actionContext
    );
    vm.runInContext(
        "toggleProductWishlist(); addCurrentProductToCart(); buyNow()",
        actionContext
    );
    assert.equal(
        actionContext.savedWishlist[0].id,
        "stable-product-id"
    );
    assert.equal(
        actionContext.cartArgs[4],
        3
    );
    assert.match(
        actionContext.window.location.href,
        /order\.html\?name=Firestore\+Necklace&price=1499/
    );
    console.log(
        "PASS wishlist, cart, and Buy Now use loaded product state"
    );
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
