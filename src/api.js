import { getFreshToken } from "./platform.js";

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

function normalizeCompatConfig(raw, fallbackModel, fallbackName, slot) {
  const baseUrl = String(raw?.baseUrl || "").trim();
  const apiKey = String(raw?.apiKey || "").trim();
  const model = String(raw?.model || fallbackModel || "").trim();
  const name = String(raw?.name || fallbackName || "").trim();
  if (!baseUrl || !apiKey) {
    return null;
  }
  return {
    slot,
    name: name || baseUrl,
    baseUrl,
    apiKey,
    model,
  };
}

function getCompatCandidates(settings) {
  const candidates = [];
  const primary = normalizeCompatConfig(settings?.openaiCompat || {}, settings?.model, "Primary", "primary");
  if (primary) {
    candidates.push(primary);
  }

  const backups = Array.isArray(settings?.openaiCompatBackups) ? settings.openaiCompatBackups : [];
  for (let i = 0; i < backups.length; i += 1) {
    const candidate = normalizeCompatConfig(backups[i], settings?.model, `Backup ${i + 1}`, `backup_${i + 1}`);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of candidates) {
    const key = `${item.baseUrl.toLowerCase()}|${item.apiKey}|${item.model}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  if (!deduped.length) {
    return deduped;
  }

  const preferred = String(settings?.openaiCompatPreferredConnection || "primary");
  const preferredIndex = deduped.findIndex((item) => item.slot === preferred);
  if (preferredIndex <= 0) {
    return deduped;
  }

  const ordered = [deduped[preferredIndex]];
  for (let i = 0; i < deduped.length; i += 1) {
    if (i !== preferredIndex) {
      ordered.push(deduped[i]);
    }
  }
  return ordered;
}

async function callChatGptOauthApi(systemPrompt, userPrompt, settings, handlers) {
  const token = await getFreshToken(settings);
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

async function callOpenAiCompatApi(systemPrompt, userPrompt, compat, handlers) {
  currentAbortController = new AbortController();
  const response = await fetch(`${String(compat.baseUrl).replace(/\/+$/g, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${compat.apiKey}`,
      "Content-Type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: compat.model,
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

async function callOpenAiCompatApiWithFailover(systemPrompt, userPrompt, settings, handlers) {
  const candidates = getCompatCandidates(settings);
  if (!candidates.length) {
    throw new Error("OpenAI compatible API is not configured.");
  }

  const failoverEnabled = settings?.openaiCompatFailoverEnabled !== false;
  const failures = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      return await callOpenAiCompatApi(systemPrompt, userPrompt, candidate, handlers);
    } catch (error) {
      if (error?.name === "AbortError") {
        throw error;
      }
      failures.push(`${candidate.name}: ${error?.message || "Unknown error"}`);
      if (!failoverEnabled || i === candidates.length - 1) {
        break;
      }
    }
  }

  throw new Error(`All OpenAI compatible connections failed. ${failures.join(" | ")}`.trim());
}

export async function callAi(systemPrompt, userPrompt, settings, handlers = {}) {
  try {
    if (settings.provider === "openai_compat") {
      return await callOpenAiCompatApiWithFailover(systemPrompt, userPrompt, settings, handlers);
    }
    return await callChatGptOauthApi(systemPrompt, userPrompt, settings, handlers);
  } finally {
    currentAbortController = null;
  }
}
