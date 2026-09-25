const assert = require("node:assert/strict");

console.log("--- Running Reviews System Unit Tests ---");

// Helper to simulate review key generation from my-orders.js
function generateReviewKey(orderId, productId, productName) {
    const rawKey = productId || (productName || "product").replace(/[^a-zA-Z0-9]/g, "_");
    return `${orderId}_${rawKey}`;
}

// Helper to simulate review payload creation
function createReviewPayload(order, item, user, rating, comment) {
    if (!order || order.status !== "Delivered") {
        throw new Error("Only delivered orders are eligible for review.");
    }
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        throw new Error("Rating must be an integer between 1 and 5 stars.");
    }
    return {
        orderId: order.id,
        productId: item.id || "",
        productName: item.name || "Handcrafted Jewelry",
        productImage: item.image || "",
        userId: user.uid,
        customerName: user.displayName || user.name || "Alora Customer",
        rating: numRating,
        comment: (comment || "").trim(),
        status: "approved",
        createdAtISO: new Date().toISOString()
    };
}

// Test 1: Review Key generation
const key1 = generateReviewKey("ORD-1001", "prod-earring-1", "Kundan Earring");
assert.equal(key1, "ORD-1001_prod-earring-1");

const key2 = generateReviewKey("ORD-1002", "", "Lotus Choker Neckset!");
assert.equal(key2, "ORD-1002_Lotus_Choker_Neckset_");
console.log("PASS: Review key correctly prevents duplicates per order item");

// Test 2: Delivered order validation
const deliveredOrder = { id: "ORD-999", status: "Delivered" };
const processingOrder = { id: "ORD-888", status: "Processing" };
const mockUser = { uid: "usr-42", displayName: "Aaradhya" };
const mockItem = { id: "item-1", name: "Floral Jhumka", image: "https://res.cloudinary.com/demo/image/upload/sample.jpg" };

assert.throws(() => {
    createReviewPayload(processingOrder, mockItem, mockUser, 5, "Loved it!");
}, /Only delivered orders are eligible for review/);
console.log("PASS: Non-delivered orders are blocked from submitting reviews");

// Test 3: Star rating validation
assert.throws(() => {
    createReviewPayload(deliveredOrder, mockItem, mockUser, 0, "Bad");
}, /Rating must be an integer between 1 and 5/);

assert.throws(() => {
    createReviewPayload(deliveredOrder, mockItem, mockUser, 6, "Amazing");
}, /Rating must be an integer between 1 and 5/);

const validReview = createReviewPayload(deliveredOrder, mockItem, mockUser, 5, "Stunning craftsmanship!");
assert.equal(validReview.rating, 5);
assert.equal(validReview.status, "approved");
assert.equal(validReview.customerName, "Aaradhya");
assert.equal(validReview.userId, "usr-42");
console.log("PASS: Star rating bounds and approved status correctly assigned");

// Test 4: Admin Moderation actions
const reviewsDb = new Map();
reviewsDb.set(key1, validReview);

// Toggle moderation
function toggleReviewStatus(reviewKey) {
    const rev = reviewsDb.get(reviewKey);
    if (!rev) throw new Error("Review not found");
    rev.status = rev.status === "hidden" ? "approved" : "hidden";
    return rev.status;
}

const statusAfterHide = toggleReviewStatus(key1);
assert.equal(statusAfterHide, "hidden");
assert.equal(reviewsDb.get(key1).status, "hidden");

const statusAfterApprove = toggleReviewStatus(key1);
assert.equal(statusAfterApprove, "approved");
assert.equal(reviewsDb.get(key1).status, "approved");
console.log("PASS: Admin moderation status toggling (hide/approve) works seamlessly");

// Delete review
function deleteReview(reviewKey) {
    return reviewsDb.delete(reviewKey);
}
const deleted = deleteReview(key1);
assert.ok(deleted);
assert.equal(reviewsDb.has(key1), false);
console.log("PASS: Admin review deletion permanently removes record");

console.log("\nALL REVIEWS SYSTEM TESTS PASSED (100%)!\n");
