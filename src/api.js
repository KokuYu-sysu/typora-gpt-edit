import { readToken } from "./platform.js";

const CODEX_URL = "https://chatgpt.com/backend-api/codex/responses";
let currentAbortController = null;

export function abortCurrentRequest() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

async function parseCodexSse(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop();

    for (const eventBlock of events) {
      let data = "";
      for (const line of eventBlock.split("\n")) {
        if (line.startsWith("data:")) {
          data += line.slice(5).trimStart();
        }
      }

      if (!data || data === "[DONE]") {
        continue;
      }

      const event = JSON.parse(data);
      if (event.type === "response.output_text.delta" && event.delta) {
        result += event.delta;
        if (onChunk) {
          onChunk(event.delta);
        }
      }
      if (event.type === "error" || event.type === "response.failed") {
        throw new Error(event.message || "Request failed.");
      }
    }
  }

  return result;
}

async function parseOpenAiSse(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) {
        continue;
      }

      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }

      const event = JSON.parse(data);
      const delta = event?.choices?.[0]?.delta?.content;
      if (delta) {
        result += delta;
        if (onChunk) {
          onChunk(delta);
        }
      }
    }
  }

  return result;
}

async function callChatGptOauthApi(systemPrompt, userPrompt, settings, handlers) {
  const token = readToken(settings);
  if (!token) {
    throw new Error("OAuth token unavailable.");
  }

  currentAbortController = new AbortController();
  const response = await fetch(CODEX_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access}`,
      "chatgpt-account-id": token.account_id,
      "OpenAI-Beta": "responses=experimental",
      originator: "typora-plugin-ai-edit",
      "User-Agent": "typora-plugin-ai-edit/0.1.0",
      accept: "text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      store: false,
      stream: true,
      instructions: systemPrompt,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: userPrompt },
          ],
        },
      ],
      include: ["reasoning.encrypted_content"],
    }),
    signal: currentAbortController.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${errorText.slice(0, 200)}`);
  }

  return parseCodexSse(response, handlers?.onChunk);
}

async function callOpenAiCompatApi(systemPrompt, userPrompt, settings, handlers) {
  const compat = settings.openaiCompat || {};
  if (!compat.baseUrl || !compat.apiKey) {
    throw new Error("OpenAI compatible API is not configured.");
  }

  currentAbortController = new AbortController();
  const response = await fetch(`${compat.baseUrl.replace(/\/+$/g, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${compat.apiKey}`,
      "Content-Type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: compat.model || settings.model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: currentAbortController.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${errorText.slice(0, 200)}`);
  }

  return parseOpenAiSse(response, handlers?.onChunk);
}

export async function callAi(systemPrompt, userPrompt, settings, handlers = {}) {
  try {
    if (settings.provider === "openai_compat") {
      return await callOpenAiCompatApi(systemPrompt, userPrompt, settings, handlers);
    }
    return await callChatGptOauthApi(systemPrompt, userPrompt, settings, handlers);
  } finally {
    currentAbortController = null;
  }
}
