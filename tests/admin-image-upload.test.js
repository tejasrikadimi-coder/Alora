const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

// 1. Verify firebase.js NO LONGER imports or exports storage
const firebaseJsSource = fs.readFileSync(path.join(projectRoot, "firebase.js"), "utf8");
assert.ok(
    !firebaseJsSource.includes("firebase-storage.js"),
    "firebase.js must NOT import from firebase-storage.js"
);
assert.ok(
    !firebaseJsSource.includes("getStorage"),
    "firebase.js must NOT import or call getStorage"
);
assert.ok(
    !/export\s*\{[^}]*\bstorage\b[^}]*\}/.test(firebaseJsSource),
    "firebase.js must NOT export storage"
);
assert.ok(
    /export\s*\{[^}]*\bdb\b[^}]*\}/.test(firebaseJsSource),
    "firebase.js must export db (Firestore)"
);
assert.ok(
    /export\s*\{[^}]*\bauth\b[^}]*\}/.test(firebaseJsSource),
    "firebase.js must export auth"
);
console.log("PASS: firebase.js cleanly decoupled from Firebase Storage while preserving Auth and Firestore");

// 2. Verify firebase.json NO LONGER contains storage block
const firebaseJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "firebase.json"), "utf8"));
assert.strictEqual(
    firebaseJson.storage,
    undefined,
    "firebase.json must NOT contain a storage configuration block"
);
console.log("PASS: firebase.json storage configuration cleanly removed");

// 3. Verify admin.html has Cloudinary config block and file inputs
const adminHtml = fs.readFileSync(path.join(projectRoot, "admin.html"), "utf8");
assert.ok(
    adminHtml.includes("window.ALORA_CLOUDINARY_CONFIG"),
    "admin.html must declare window.ALORA_CLOUDINARY_CONFIG"
);
assert.ok(
    adminHtml.includes('cloudName: "vgjfpkoh"'),
    "admin.html ALORA_CLOUDINARY_CONFIG must have cloudName: vgjfpkoh"
);
assert.ok(
    adminHtml.includes('uploadPreset: "alora_products"'),
    "admin.html ALORA_CLOUDINARY_CONFIG must have uploadPreset: alora_products"
);
assert.ok(
    !adminHtml.includes("api_secret") && !adminHtml.includes("apiSecret"),
    "admin.html must NEVER expose Cloudinary API secrets"
);
assert.ok(
    adminHtml.includes('id="adminProductImageFile"'),
    "admin.html must contain #adminProductImageFile"
);
assert.ok(
    adminHtml.includes('accept="image/*"'),
    "admin.html must have accept='image/*'"
);
assert.ok(
    adminHtml.includes('id="adminEditProductImageFile"'),
    "admin.html must contain #adminEditProductImageFile in edit modal"
);
const imageInputTag = adminHtml.match(/<input[^>]*id="adminProductImage"[^>]*>/i);
assert.ok(imageInputTag, "#adminProductImage input tag should exist");
assert.ok(
    !imageInputTag[0].includes("required"),
    "#adminProductImage must not be required so gallery upload can be used exclusively"
);
console.log("PASS: admin.html contains Cloudinary configuration and file input elements without secrets");

// 4. Verify admin.js does NOT import firebase-storage
const adminJsSource = fs.readFileSync(path.join(projectRoot, "admin.js"), "utf8");
assert.ok(
    !adminJsSource.includes("firebase-storage.js"),
    "admin.js must NOT import from firebase-storage.js"
);
assert.ok(
    !adminJsSource.includes("uploadBytes"),
    "admin.js must NOT use uploadBytes"
);
assert.ok(
    adminJsSource.includes('cloudName: "vgjfpkoh"'),
    "admin.js DEFAULT_CLOUDINARY_CONFIG must have cloudName: vgjfpkoh"
);
assert.ok(
    adminJsSource.includes('uploadPreset: "alora_products"'),
    "admin.js DEFAULT_CLOUDINARY_CONFIG must have uploadPreset: alora_products"
);
console.log("PASS: admin.js has no Firebase Storage dependencies and has real Cloudinary config");

// 5. Test validation, sanitization, and Cloudinary upload logic in VM context
function extractFunction(name) {
    let start = adminJsSource.indexOf(`async function ${name}`);
    if (start === -1) {
        start = adminJsSource.indexOf(`function ${name}`);
    }
    assert.notEqual(start, -1, `Function ${name} should exist in admin.js`);
    const openBrace = adminJsSource.indexOf("{", start);
    let depth = 0;
    let end = -1;
    for (let i = openBrace; i < adminJsSource.length; i++) {
        if (adminJsSource[i] === "{") depth++;
        else if (adminJsSource[i] === "}") {
            depth--;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    return adminJsSource.slice(start, end);
}

const vm = require("node:vm");

// Test with mock fetch
let lastFetchUrl = null;
let lastFetchOptions = null;
let mockFetchResponse = {
    ok: true,
    status: 200,
    json: async () => ({
        secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v12345/alora_products/ring.jpg",
        public_id: "alora_products/ring",
        format: "jpg",
        width: 600,
        height: 600
    })
};

const testContext = vm.createContext({
    MAX_PRODUCT_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
    ALLOWED_IMAGE_MIME_TYPES: new Set([
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ]),
    DEFAULT_CLOUDINARY_CONFIG: {
        cloudName: "vgjfpkoh",
        uploadPreset: "alora_products"
    },
    FormData: class MockFormData {
        constructor() {
            this.fields = new Map();
        }
        append(key, val) {
            this.fields.set(key, val);
        }
        get(key) {
            return this.fields.get(key);
        }
    },
    encodeURIComponent,
    fetch: async (url, options) => {
        lastFetchUrl = url;
        lastFetchOptions = options;
        return mockFetchResponse;
    },
    window: {
        ALORA_CLOUDINARY_CONFIG: {
            cloudName: "vgjfpkoh",
            uploadPreset: "alora_products"
        }
    },
    console
});

vm.runInContext(extractFunction("sanitizeProductFileName"), testContext);
vm.runInContext(extractFunction("validateProductImageFile"), testContext);
vm.runInContext(extractFunction("getCloudinaryConfig"), testContext);
vm.runInContext(extractFunction("uploadProductImageToCloudinary"), testContext);

const { sanitizeProductFileName, validateProductImageFile, getCloudinaryConfig, uploadProductImageToCloudinary } = testContext;

// Test sanitizeProductFileName
assert.equal(sanitizeProductFileName("Diamond Ring (1).PNG"), "diamond-ring-1.png");
assert.equal(sanitizeProductFileName("necklace!@#.webp"), "necklace.webp");
assert.equal(sanitizeProductFileName(null), "image.jpg");
console.log("PASS: sanitizeProductFileName correctly formats file names");

// Test validateProductImageFile
assert.strictEqual(validateProductImageFile(null).valid, false);
assert.strictEqual(validateProductImageFile({ name: "gold.jpg", type: "image/jpeg", size: 1024 }).valid, true);
assert.strictEqual(validateProductImageFile({ name: "gold.png", type: "image/png", size: 1024 }).valid, true);
assert.strictEqual(validateProductImageFile({ name: "gold.webp", type: "image/webp", size: 1024 }).valid, true);
assert.strictEqual(validateProductImageFile({ name: "bad.pdf", type: "application/pdf", size: 1024 }).valid, false);
assert.strictEqual(validateProductImageFile({ name: "big.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 }).valid, false);
console.log("PASS: validateProductImageFile enforces formats and 5MB size limit");

// Test getCloudinaryConfig
const cfg = getCloudinaryConfig();
assert.equal(cfg.cloudName, "vgjfpkoh");
assert.equal(cfg.uploadPreset, "alora_products");
console.log("PASS: getCloudinaryConfig correctly reads window.ALORA_CLOUDINARY_CONFIG");

// Test fallback to DEFAULT_CLOUDINARY_CONFIG
testContext.window.ALORA_CLOUDINARY_CONFIG = null;
const fallbackCfg = getCloudinaryConfig();
assert.equal(fallbackCfg.cloudName, "vgjfpkoh");
assert.equal(fallbackCfg.uploadPreset, "alora_products");
console.log("PASS: getCloudinaryConfig falls back to DEFAULT_CLOUDINARY_CONFIG if window config is absent");
testContext.window.ALORA_CLOUDINARY_CONFIG = {
    cloudName: "vgjfpkoh",
    uploadPreset: "alora_products"
};

async function runCloudinaryUploadTests() {
    // Test successful upload
    const validFile = { name: "test-ring.jpg", type: "image/jpeg", size: 50000 };
    let progressMessages = [];
    const result = await uploadProductImageToCloudinary(validFile, msg => progressMessages.push(msg));

    assert.equal(
        lastFetchUrl,
        "https://api.cloudinary.com/v1_1/vgjfpkoh/image/upload",
        "Must post to Cloudinary v1_1/{cloudName}/image/upload"
    );
    assert.equal(lastFetchOptions.method, "POST");
    assert.equal(lastFetchOptions.body.get("upload_preset"), "alora_products");
    assert.equal(lastFetchOptions.body.get("file"), validFile);
    assert.equal(lastFetchOptions.body.get("folder"), "alora_products");
    assert.equal(
        result.secure_url,
        "https://res.cloudinary.com/test-cloud/image/upload/v12345/alora_products/ring.jpg"
    );
    assert.ok(progressMessages.length > 0, "Progress callback should be invoked");
    console.log("PASS: uploadProductImageToCloudinary dispatches correct FormData and returns secure_url");

    // Test upload error handling
    mockFetchResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
            error: { message: "Invalid upload preset" }
        })
    };

    let threw = false;
    try {
        await uploadProductImageToCloudinary(validFile);
    } catch (err) {
        threw = true;
        assert.ok(err.message.includes("Invalid upload preset"), "Error should contain Cloudinary message");
    }
    assert.ok(threw, "uploadProductImageToCloudinary must throw on failure");
    console.log("PASS: uploadProductImageToCloudinary surfaces Cloudinary error messages");

    // Test unconfigured cloudName / uploadPreset
    testContext.window.ALORA_CLOUDINARY_CONFIG = {
        cloudName: "YOUR_CLOUD_NAME",
        uploadPreset: "YOUR_UNSIGNED_UPLOAD_PRESET"
    };
    testContext.DEFAULT_CLOUDINARY_CONFIG = {
        cloudName: "YOUR_CLOUD_NAME",
        uploadPreset: "YOUR_UNSIGNED_UPLOAD_PRESET"
    };
    let unconfiguredThrew = false;
    try {
        await uploadProductImageToCloudinary(validFile);
    } catch (err) {
        unconfiguredThrew = true;
        assert.ok(err.message.includes("not configured"), "Error should explain configuration is missing");
    }
    assert.ok(unconfiguredThrew, "Must reject upload if cloudName or uploadPreset is default placeholder");
    console.log("PASS: uploadProductImageToCloudinary rejects unconfigured placeholder settings gracefully");

    // 6. Test strict guard against local/relative paths and required debug logs in admin.js
    assert.ok(
        adminJsSource.includes("[ALORA PRODUCT UPLOAD DEBUG] selected file:"),
        "admin.js must log selected file with [ALORA PRODUCT UPLOAD DEBUG] prefix"
    );
    assert.ok(
        adminJsSource.includes("[ALORA PRODUCT UPLOAD DEBUG] Cloudinary response:"),
        "admin.js must log Cloudinary response with [ALORA PRODUCT UPLOAD DEBUG] prefix"
    );
    assert.ok(
        adminJsSource.includes("[ALORA PRODUCT UPLOAD DEBUG] secure_url:"),
        "admin.js must log secure_url with [ALORA PRODUCT UPLOAD DEBUG] prefix"
    );
    assert.ok(
        adminJsSource.includes("[ALORA PRODUCT UPLOAD DEBUG] final Firestore image value:"),
        "admin.js must log final Firestore image value with [ALORA PRODUCT UPLOAD DEBUG] prefix"
    );
    assert.ok(
        adminJsSource.includes("finalImageUrl.startsWith(\"images/\")") ||
        adminJsSource.includes("manualImage.startsWith(\"images/\")"),
        "admin.js must explicitly block local paths starting with 'images/'"
    );
    assert.ok(
        adminJsSource.includes("currentSelectedProductFile"),
        "admin.js must maintain persistent state for selected product file"
    );
    console.log("PASS: admin.js contains all required debug logs, local path guards, and file state retention");

    console.log("\nALL CLOUDINARY PRODUCT IMAGE UPLOAD TESTS PASSED (100%)!");
}

runCloudinaryUploadTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});

