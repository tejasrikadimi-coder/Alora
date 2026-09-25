const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "script.js"),
    "utf8"
);

function extractFunction(name, nextName) {
    const start = source.indexOf(`function ${name}`);
    assert.notEqual(start, -1);
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

const migrationSource =
    extractFunction(
        "resolveGuestItems",
        "initializeAccountPersistence"
    );
const accountItemsSource =
    extractFunction(
        "getAccountItems",
        "getCorrectProduct"
    );

const context = vm.createContext({
    activeAccountUid: null,
    authStateKnown: true,
    accountDataLoaded: false,
    accountDataError: null,
    accountWishlist: [],
    accountCart: [],
    getStoredArray: () => [],
    normalizeProduct: item => item
});

vm.runInContext(
    `${migrationSource}\n${accountItemsSource}`,
    context
);

const products = [
    {
        id: "lotus-id",
        name: "Lotus Neckset"
    },
    {
        id: "pins-id",
        name: "Hair Pins"
    }
];

const migrated = vm.runInContext(
    `resolveGuestItems(
        [
            { name: "Lotus Neckset", quantity: 2 },
            { name: "Missing", quantity: 1 },
            { id: "pins-id", quantity: 3 }
        ],
        ${JSON.stringify(products)}
    )`,
    context
);

assert.deepEqual(
    migrated.map(item => ({
        id: item.id,
        quantity: item.quantity
    })),
    [
        { id: "lotus-id", quantity: 2 },
        { id: "pins-id", quantity: 3 }
    ]
);
console.log(
    "PASS guest migration keeps only unambiguous stable product IDs"
);

context.activeAccountUid = "customer-a";
context.accountDataLoaded = true;
context.accountWishlist = [{ id: "a" }];
context.accountCart = [
    { id: "a", quantity: 4 }
];

const firstAccountItems = vm.runInContext(
    "getAccountItems('cart')",
    context
);
assert.deepEqual(
    firstAccountItems,
    [{ id: "a", quantity: 4 }]
);
console.log(
    "PASS account A reads only account A in-memory data"
);

context.activeAccountUid = "customer-b";
context.accountWishlist = [{ id: "b" }];
context.accountCart = [
    { id: "b", quantity: 1 }
];

const secondAccountItems = vm.runInContext(
    "getAccountItems('cart')",
    context
);
assert.deepEqual(
    secondAccountItems,
    [{ id: "b", quantity: 1 }]
);
assert.notDeepEqual(
    secondAccountItems,
    firstAccountItems
);
console.log(
    "PASS account switching replaces prior cart state"
);
