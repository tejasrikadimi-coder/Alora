const fs = require("node:fs");
const path = require("node:path");

const rootRules = path.resolve(
    __dirname,
    "../../firestore.rules"
);
const fixtureRules = path.resolve(
    __dirname,
    "firestore.rules"
);

fs.copyFileSync(rootRules, fixtureRules);
console.log(
    `Synchronized ${rootRules} -> ${fixtureRules}`
);
