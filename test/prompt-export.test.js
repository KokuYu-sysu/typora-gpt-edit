import assert from "node:assert/strict";

import {
  buildPromptExportPayload,
  extractPromptsFromImportedPayload,
} from "../src/platform.js";

const settings = {
  provider: "chatgpt",
  model: "gpt-5.4",
  openaiCompat: { model: "gpt-5.4-mini" },
  prompts: {
    optimize: { system: "custom optimize system", user: "custom optimize user" },
  },
};

const payload = buildPromptExportPayload(settings);

assert.deepEqual(Object.keys(payload), ["prompts_current"]);
assert.deepEqual(payload.prompts_current, settings.prompts);

const extractedFromWrapped = extractPromptsFromImportedPayload({
  prompts_current: settings.prompts,
});
assert.deepEqual(extractedFromWrapped, settings.prompts);

const extractedFromDirect = extractPromptsFromImportedPayload(settings.prompts);
assert.deepEqual(extractedFromDirect, settings.prompts);

assert.throws(() => extractPromptsFromImportedPayload(null));
assert.throws(() => extractPromptsFromImportedPayload([]));

console.log("prompt-export tests passed");
