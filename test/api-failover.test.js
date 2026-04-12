import assert from "node:assert/strict";

import { callAi } from "../src/api.js";

function createSseResponse(text) {
  const encoder = new TextEncoder();
  const payload = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(payload));
        controller.close();
      },
    }),
  };
}

const originalFetch = globalThis.fetch;
let callCount = 0;

globalThis.fetch = async (url) => {
  callCount += 1;
  if (callCount === 1) {
    throw new Error("primary endpoint down");
  }
  assert.ok(String(url).startsWith("https://backup.example.com/chat/completions"));
  return createSseResponse("backup-ok");
};

const settings = {
  provider: "openai_compat",
  model: "gpt-5.4",
  openaiCompat: {
    baseUrl: "https://primary.example.com",
    apiKey: "primary-key",
    model: "gpt-4o-mini",
  },
  openaiCompatBackups: [
    {
      baseUrl: "https://backup.example.com",
      apiKey: "backup-key",
      model: "gpt-4o-mini",
    },
  ],
};

const result = await callAi("sys", "user", settings, {});
assert.equal(result, "backup-ok");
assert.equal(callCount, 2);

globalThis.fetch = originalFetch;
console.log("api failover tests passed");
