import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { prepareImageInputForModel } from "../src/platform.js";

global.require = createRequire(import.meta.url);

const dataUrl = "data:image/png;base64,AAA=";
assert.equal(prepareImageInputForModel(dataUrl), dataUrl);

const httpUrl = "https://example.com/image.png";
assert.equal(prepareImageInputForModel(httpUrl), httpUrl);

const tmpDir = path.resolve("test", ".tmp");
fs.mkdirSync(tmpDir, { recursive: true });
const localPng = path.join(tmpDir, "sample.png");
fs.writeFileSync(localPng, "not-real-png-bytes", "utf8");

const localDataUrl = prepareImageInputForModel(localPng);
assert.ok(localDataUrl.startsWith("data:image/png;base64,"));

const fileUrlData = prepareImageInputForModel(pathToFileURL(localPng).toString());
assert.ok(fileUrlData.startsWith("data:image/png;base64,"));

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log("image-input tests passed");
