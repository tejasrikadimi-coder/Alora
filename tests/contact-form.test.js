const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "script.js"),
    "utf8"
);

function extractFunction(name) {
    const start = source.indexOf(`function ${name}`);
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

const values = {
    name: "Customer",
    email: "customer@example.test",
    subject: "Question",
    message: "I have a question."
};
const status = {
    textContent: "",
    className: ""
};
const submitButton = {
    disabled: false,
    textContent: "Send Message"
};
let resetCount = 0;
let saveCalls = 0;
let saveError = null;
let currentUser = {
    uid: "customer-1"
};

const form = {
    querySelector() {
        return submitButton;
    },
    reset() {
        resetCount += 1;
    }
};

const context = vm.createContext({
    console,
    document: {
        getElementById(id) {
            if (id === "contactMessage") {
                return status;
            }
            return {
                value: values[id]
            };
        }
    },
    contactAuthUser: currentUser,
    contactMessageInFlight: false,
    getFirestoreModules() {
        return Promise.resolve({
            firebase: {
                db: {}
            },
            firestore: {
                collection() {
                    return {};
                },
                serverTimestamp() {
                    return "SERVER_TIMESTAMP";
                },
                addDoc(_collection, payload) {
                    saveCalls += 1;
                    if (saveError) {
                        return Promise.reject(saveError);
                    }
                    context.savedPayload = payload;
                    return Promise.resolve({
                        id: "message-1"
                    });
                }
            }
        });
    },
    Promise,
    Error,
    console
});

vm.runInContext(
    extractFunction("sendMessage"),
    context
);

async function submit() {
    vm.runInContext(
        "sendMessage({ preventDefault() {}, target: form })",
        context
    );
    await new Promise(resolve => setImmediate(resolve));
}

(async function run() {
    context.form = form;
    await submit();
    assert.equal(saveCalls, 1);
    assert.equal(resetCount, 1);
    assert.equal(context.savedPayload.userId, "customer-1");
    assert.equal(context.savedPayload.status, "New");
    assert.equal(status.className, "contact-message success");
    console.log("PASS successful contact message save");

    saveError = new Error("synthetic save failure");
    values.message = "Keep this message";
    await submit();
    assert.equal(resetCount, 1);
    assert.equal(values.message, "Keep this message");
    assert.equal(status.className, "contact-message error");
    console.log("PASS failed save preserves input");

    saveError = null;
    values.message = "Duplicate click test";
    context.contactMessageInFlight = true;
    const beforeDuplicate = saveCalls;
    await submit();
    assert.equal(saveCalls, beforeDuplicate);
    context.contactMessageInFlight = false;
    console.log("PASS duplicate submission is blocked");

    context.contactAuthUser = null;
    await submit();
    assert.equal(saveCalls, beforeDuplicate);
    assert.match(status.textContent, /log in/i);
    console.log("PASS signed-out submission shows login prompt");
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
