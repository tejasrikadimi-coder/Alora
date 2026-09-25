const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "auth.js"),
    "utf8"
);

function createHarness({
    send = "resolve",
    email = "customer@example.com"
} = {}) {
    const calls = [];
    let resolvePending;
    const pending = new Promise(resolve => {
        resolvePending = resolve;
    });
    const emailInput = { value: email };
    const message = {
        textContent: "",
        classList: {
            toggle() {},
            remove() {}
        }
    };
    const resetButton = {
        disabled: false,
        textContent: "Forgot Password?",
        addEventListener(type, handler) {
            if (type === "click") {
                this.clickHandler = handler;
            }
        }
    };
    const loginForm = {
        addEventListener(type, handler) {
            if (type === "submit") {
                this.submitHandler = handler;
            }
        },
        querySelector() {
            return {
                disabled: false,
                textContent: "Login"
            };
        }
    };
    const registerForm = {
        addEventListener() {},
        querySelector() {
            return {};
        }
    };
    const context = {
        console,
        auth: {},
        db: {},
        document: {
            getElementById(id) {
                return {
                    loginSection: {},
                    registerSection: {},
                    loginForm,
                    registerForm,
                    loginMessage: message,
                    registerMessage: message,
                    forgotPasswordButton: resetButton,
                    loginEmail: emailInput,
                    loginPassword: { value: "" }
                }[id];
            }
        },
        window: {},
        sessionStorage: { getItem() { return null; } },
        setTimeout() {},
        createUserWithEmailAndPassword: async () => ({}),
        signInWithEmailAndPassword: async () => ({}),
        updateProfile: async () => {},
        doc: () => ({}),
        setDoc: async () => {},
        sendPasswordResetEmail: async (auth, address) => {
            calls.push(address);
            if (send === "reject") {
                const error = new Error("failed");
                error.code = "auth/network-request-failed";
                throw error;
            }
            if (send === "pending") {
                return pending;
            }
        }
    };
    context.window.window = context.window;
    vm.createContext(context);
    vm.runInContext(
        source
            .replace(
                /import[\s\S]*?from\s*["'][^"']+["'];/g,
                ""
            ),
        context
    );
    return {
        context,
        calls,
        emailInput,
        message,
        resetButton,
        resolvePending
    };
}

async function main() {
    const tests = [];
    async function check(name, fn) {
        try {
            await fn();
            tests.push(`PASS ${name}`);
        } catch (error) {
            tests.push(`FAIL ${name}: ${error.message}`);
            throw error;
        }
    }

    await check("valid submission", async () => {
        const h = createHarness();
        await h.resetButton.clickHandler();
        assert.deepEqual(h.calls, ["customer@example.com"]);
        assert.match(h.message.textContent, /If an account exists/);
        assert.equal(h.resetButton.disabled, false);
    });
    await check("invalid email without password", async () => {
        const h = createHarness({ email: "not-an-email" });
        await h.resetButton.clickHandler();
        assert.equal(h.calls.length, 0);
        assert.match(h.message.textContent, /valid email/);
    });
    await check("duplicate click while sending", async () => {
        const h = createHarness({ send: "pending" });
        const first = h.resetButton.clickHandler();
        const second = h.resetButton.clickHandler();
        assert.equal(h.calls.length, 1);
        h.resolvePending();
        await first;
        await second;
        assert.equal(h.calls.length, 1);
    });
    await check("API failure re-enables button", async () => {
        const h = createHarness({ send: "reject" });
        await h.resetButton.clickHandler();
        assert.match(h.message.textContent, /Network error/);
        assert.equal(h.resetButton.disabled, false);
        assert.equal(
            h.resetButton.textContent,
            "Forgot Password?"
        );
    });
    console.log(tests.join("\n"));
}

main().catch(error => {
    console.error("FAIL forgot-password tests:", error.message);
    process.exitCode = 1;
});
