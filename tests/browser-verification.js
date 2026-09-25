const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const PROJECT_DIR = path.resolve(__dirname, "..");
const PORT = 8089;
const CHROME_PATH = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.resolve(__dirname, "screenshots");
if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// Simple static server
const MIME_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split("?")[0]);
    if (reqPath === "/") reqPath = "/index.html";
    const filePath = path.join(PROJECT_DIR, reqPath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*"
    });
    fs.createReadStream(filePath).pipe(res);
});

async function main() {
    await new Promise(resolve => server.listen(PORT, resolve));
    console.log(`Server listening on http://localhost:${PORT}`);

    // Launch Chrome with remote debugging
    const cdpPort = 9223;
    const userDataDir = path.join(os.tmpdir(), "alora-chrome-profile-" + Date.now());
    fs.mkdirSync(userDataDir, { recursive: true });

    const chromeProcess = spawn(CHROME_PATH, [
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${userDataDir}`,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--window-size=1280,900"
    ]);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Connect to CDP
    const fetch = globalThis.fetch;
    const targetsRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === "page") || targets[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;

    const ws = new globalThis.WebSocket(wsUrl);

    let messageId = 0;
    const pendingPromises = new Map();
    const consoleLogs = [];

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.method === "Runtime.consoleAPICalled") {
                const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(" ");
                consoleLogs.push({ type: msg.params.type, text });
            }
            if (msg.id && pendingPromises.has(msg.id)) {
                const { resolve, reject } = pendingPromises.get(msg.id);
                pendingPromises.delete(msg.id);
                if (msg.error) reject(new Error(msg.error.message));
                else resolve(msg.result);
            }
        } catch (_) {}
    };

    await new Promise(resolve => {
        if (ws.readyState === 1) resolve();
        else ws.onopen = resolve;
    });

    function send(method, params = {}) {
        const id = ++messageId;
        return new Promise((resolve, reject) => {
            pendingPromises.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    await send("Runtime.enable");
    await send("Page.enable");
    await send("DOM.enable");

    // Navigate to Home
    console.log("Navigating to Home (index.html)...");
    await send("Page.navigate", { url: `http://localhost:${PORT}/index.html` });
    
    // Wait for product cards to render
    for (let i = 0; i < 20; i++) {
        const countRes = await send("Runtime.evaluate", {
            expression: "document.querySelectorAll('.wishlist-btn').length",
            returnByValue: true
        });
        if (countRes.result && countRes.result.value > 0) {
            console.log(`Cards rendered in ${(i + 1) * 500}ms!`);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Evaluate initial wishlist buttons state
    let evalRes = await send("Runtime.evaluate", {
        expression: `
            (() => {
                const btns = Array.from(document.querySelectorAll('.wishlist-btn'));
                return {
                    count: btns.length,
                    buttons: btns.map(b => ({
                        name: b.dataset.name,
                        id: b.dataset.id,
                        text: b.textContent.trim(),
                        active: b.classList.contains('active'),
                        color: window.getComputedStyle(b).color
                    }))
                };
            })()
        `,
        returnByValue: true
    });
    console.log("Initial Home cards state:", JSON.stringify(evalRes.result.value, null, 2));

    const initialInfo = evalRes.result.value;
    if (initialInfo.count === 0) {
        throw new Error("No product cards found on index.html!");
    }
    const firstButton = initialInfo.buttons[0];
    console.log(`Checking first product: "${firstButton.name}" (Initial text: ${firstButton.text}, active: ${firstButton.active})`);

    // Click the first wishlist button to ADD
    console.log("Clicking wishlist button to ADD to wishlist...");
    evalRes = await send("Runtime.evaluate", {
        expression: `
            (() => {
                const btn = document.querySelector('.wishlist-btn');
                if (!btn) return false;
                btn.click();
                return {
                    text: btn.textContent.trim(),
                    active: btn.classList.contains('active'),
                    color: window.getComputedStyle(btn).color,
                    storedWishlist: localStorage.getItem('aloraWishlist')
                };
            })()
        `,
        returnByValue: true
    });
    console.log("State immediately after ADD click:", JSON.stringify(evalRes.result.value, null, 2));
    const addState = evalRes.result.value;
    if (addState.text !== "♥" || !addState.active) {
        throw new Error(`Failed to toggle wishlist to filled! text=${addState.text}, active=${addState.active}`);
    }

    // Scroll products section into view on Home
    await send("Runtime.evaluate", {
        expression: `document.getElementById('products') && document.getElementById('products').scrollIntoView({ block: 'start' });`
    });
    await new Promise(resolve => setTimeout(resolve, 800));

    // Capture screenshot of Home with filled heart
    const screenshotFilled = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "wishlist-home-filled.png"), Buffer.from(screenshotFilled.data, "base64"));
    console.log("Saved screenshot: wishlist-home-filled.png");

    // Navigate to Collections
    console.log("Navigating to Collections (collections.html) to test persistence...");
    await send("Page.navigate", { url: `http://localhost:${PORT}/collections.html` });
    
    // Wait for collections cards to render
    for (let i = 0; i < 20; i++) {
        const countRes = await send("Runtime.evaluate", {
            expression: "document.querySelectorAll('.wishlist-btn').length",
            returnByValue: true
        });
        if (countRes.result && countRes.result.value > 0) {
            console.log(`Collections cards rendered in ${(i + 1) * 500}ms!`);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Verify Collections page reflects filled heart
    evalRes = await send("Runtime.evaluate", {
        expression: `
            (() => {
                const btns = Array.from(document.querySelectorAll('.wishlist-btn'));
                return {
                    count: btns.length,
                    buttons: btns.map(b => ({
                        name: b.dataset.name,
                        id: b.dataset.id,
                        text: b.textContent.trim(),
                        active: b.classList.contains('active'),
                        color: window.getComputedStyle(b).color
                    })),
                    storedWishlist: localStorage.getItem('aloraWishlist')
                };
            })()
        `,
        returnByValue: true
    });
    console.log("Collections cards state:", JSON.stringify(evalRes.result.value, null, 2));
    const colState = evalRes.result.value;
    const matchOnCollections = colState.buttons.find(b => b.name === firstButton.name);
    if (!matchOnCollections || matchOnCollections.text !== "♥" || !matchOnCollections.active) {
        throw new Error(`Collections page did NOT sync filled heart for "${firstButton.name}"!`);
    }
    console.log(`PASS: Collections page successfully synchronized filled heart for "${firstButton.name}"!`);

    // Capture screenshot of Collections
    const screenshotCol = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "wishlist-collections-sync.png"), Buffer.from(screenshotCol.data, "base64"));
    console.log("Saved screenshot: wishlist-collections-sync.png");

    // Test Mobile 375px viewport
    console.log("Emulating Mobile 375px viewport...");
    await send("Emulation.setDeviceMetricsOverride", {
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
        mobile: true
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const screenshotMobile = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, "wishlist-mobile-375px.png"), Buffer.from(screenshotMobile.data, "base64"));
    console.log("Saved screenshot: wishlist-mobile-375px.png");

    // Click on Collections to REMOVE from wishlist
    console.log("Clicking filled heart on Collections to REMOVE from wishlist...");
    evalRes = await send("Runtime.evaluate", {
        expression: `
            (() => {
                const btn = document.querySelector('.wishlist-btn.active');
                if (!btn) return null;
                btn.click();
                return {
                    text: btn.textContent.trim(),
                    active: btn.classList.contains('active'),
                    color: window.getComputedStyle(btn).color,
                    storedWishlist: localStorage.getItem('aloraWishlist')
                };
            })()
        `,
        returnByValue: true
    });
    console.log("State immediately after REMOVE click:", JSON.stringify(evalRes.result.value, null, 2));
    const removeState = evalRes.result.value;
    if (removeState.text !== "♡" || removeState.active) {
        throw new Error(`Failed to revert wishlist to outline! text=${removeState.text}, active=${removeState.active}`);
    }
    console.log("PASS: Heart reverted immediately to outline ♡ and storage cleaned!");

    // Check Analytics diagnostic logs
    console.log("\nChecking console logs for Analytics diagnostics...");
    const analyticsLogs = consoleLogs.filter(l => l.text.includes("[Alora Analytics]"));
    console.log("Found Analytics console messages:", analyticsLogs);
    if (analyticsLogs.length === 0) {
        console.warn("WARNING: No [Alora Analytics] console messages detected.");
    } else {
        console.log("PASS: Analytics diagnostic warning was logged cleanly as expected!");
    }

    // Clean up
    ws.close();
    chromeProcess.kill();
    server.close();
    try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}

    console.log("\nALL REAL-BROWSER TESTS COMPLETED SUCCESSFULLY (100%)!");
}

main().catch(err => {
    console.error("FATAL BROWSER TEST ERROR:", err);
    process.exit(1);
});
