const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "script.js"),
    "utf8"
);

const start = source.indexOf(
    "function buildAdminOrderUrl"
);
const openBrace = source.indexOf(
    "{",
    start
);
let depth = 0;
let end = -1;

for (
    let index = openBrace;
    index < source.length;
    index += 1
) {
    if (source[index] === "{") {
        depth += 1;
    } else if (source[index] === "}") {
        depth -= 1;
        if (depth === 0) {
            end = index + 1;
            break;
        }
    }
}

assert.notEqual(
    end,
    -1,
    "URL helper should exist"
);

const context = vm.createContext({
    URL,
    URLSearchParams,
    window: {
        location: {
            href:
                "http://127.0.0.1:5500/order.html?productId=123"
        }
    }
});

vm.runInContext(
    source.slice(start, end),
    context
);

const generatedUrl = vm.runInContext(
    "buildAdminOrderUrl(" +
    "'ALR-12345678', 'customer-uid-123'" +
    ")",
    context
);

// Explicitly fail if URL contains 127.0.0.1 or localhost
assert.equal(
    generatedUrl.includes("127.0.0.1"),
    false,
    "admin_order_url must NOT contain 127.0.0.1"
);
assert.equal(
    generatedUrl.includes("localhost"),
    false,
    "admin_order_url must NOT contain localhost"
);

// Assert exact production prefix
assert.ok(
    generatedUrl.startsWith("https://alora-handmade-jewelry.web.app/admin.html"),
    "admin_order_url must start with https://alora-handmade-jewelry.web.app/admin.html"
);

assert.equal(
    generatedUrl,
    "https://alora-handmade-jewelry.web.app/admin.html?" +
    "orderId=ALR-12345678&userId=customer-uid-123"
);

// Also verify with localhost context
const localhostContext = vm.createContext({
    URL,
    URLSearchParams,
    window: {
        location: {
            href: "http://localhost:3000/order.html"
        }
    }
});
vm.runInContext(source.slice(start, end), localhostContext);
const localhostUrl = vm.runInContext(
    "buildAdminOrderUrl('ALR-99887766', 'customer-456')",
    localhostContext
);
assert.equal(localhostUrl.includes("localhost"), false);
assert.equal(localhostUrl.includes("127.0.0.1"), false);
assert.ok(localhostUrl.startsWith("https://alora-handmade-jewelry.web.app/admin.html"));
assert.equal(
    localhostUrl,
    "https://alora-handmade-jewelry.web.app/admin.html?orderId=ALR-99887766&userId=customer-456"
);

console.log(
    "PASS generated admin order URL uses https://alora-handmade-jewelry.web.app and never localhost/127.0.0.1"
);
