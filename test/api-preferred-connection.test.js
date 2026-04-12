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
const calls = [];

globalThis.fetch = async (url) => {
  calls.push(String(url));
  return createSseResponse("preferred-ok");
};

const settings = {
  provider: "openai_compat",
  model: "gpt-5.4",
  openaiCompat: {
    baseUrl: "https://primary.example.com",
    apiKey: "primary-key",
    model: "gpt-4o-mini",
  },
  openaiCompatPreferredConnection: "backup_1",
  openaiCompatFailoverEnabled: true,
  openaiCompatBackups: [
    {
      name: "DeepSeek",
      baseUrl: "https://deepseek.example.com",
      apiKey: "deepseek-key",
      model: "deepseek-chat",
    },
    {
      name: "Backup2",
      baseUrl: "https://backup2.example.com",
      apiKey: "backup2-key",
      model: "gpt-4o-mini",
    },
  ],
};

const result = await callAi("sys", "user", settings, {});
assert.equal(result, "preferred-ok");
assert.equal(calls.length, 1);
assert.ok(calls[0].startsWith("https://deepseek.example.com/chat/completions"));

globalThis.fetch = originalFetch;
console.log("api preferred-connection tests passed");
