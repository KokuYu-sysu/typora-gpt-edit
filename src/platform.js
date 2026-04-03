function getEnvValue(env, key) {
  if (env && env[key]) {
    return env[key];
  }
  try {
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (_) {}
  return "";
}

function joinPath() {
  return Array.from(arguments)
    .filter(Boolean)
    .map((part, index) => {
      const normalized = String(part).replace(/\\/g, "/");
      return index === 0 ? normalized.replace(/\/+$/g, "") : normalized.replace(/^\/+|\/+$/g, "");
    })
    .filter(Boolean)
    .join("/");
}

function dedupePaths(paths) {
  const seen = new Set();
  const output = [];
  for (const value of paths) {
    if (!value) continue;
    const key = String(value).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

export function getTokenCandidatePathsFromEnv(settings, env) {
  const paths = [];
  if (settings && settings.oauthTokenPath) {
    paths.push(String(settings.oauthTokenPath).trim());
  }

  const appData = getEnvValue(env, "APPDATA");
  if (appData) {
    paths.push(joinPath(appData, "oauth-cli-kit", "auth", "codex.json"));
  }

  const localAppData = getEnvValue(env, "LOCALAPPDATA");
  if (localAppData) {
    paths.push(joinPath(localAppData, "oauth-cli-kit", "auth", "codex.json"));
  }

  const home = getEnvValue(env, "USERPROFILE") || getEnvValue(env, "HOME");
  if (home) {
    paths.push(joinPath(home, ".codex", "auth.json"));
  }

  return dedupePaths(paths);
}

export function getTokenCandidatePaths(settings) {
  return getTokenCandidatePathsFromEnv(settings, null);
}

function parseBase64UrlJson(segment) {
  if (!segment) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch (_) {}

  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (_) {}

  return null;
}

function deriveTokenExpiry(raw, accessToken) {
  if (raw && typeof raw.expires === "number") return raw.expires;
  if (raw && raw.tokens && typeof raw.tokens.expires === "number") return raw.tokens.expires;
  if (raw && typeof raw.expires_at === "number") return raw.expires_at;
  if (!accessToken || typeof accessToken !== "string") return null;

  const parts = accessToken.split(".");
  if (parts.length < 2) {
    return null;
  }

  const payload = parseBase64UrlJson(parts[1]);
  if (!payload || typeof payload.exp !== "number") {
    return null;
  }

  return payload.exp * 1000;
}

function detectTokenSourceType(sourcePath) {
  const lower = String(sourcePath || "").toLowerCase().replace(/\\/g, "/");
  if (lower.includes("oauth-cli-kit")) {
    return "oauth_cli_kit";
  }
  if (lower.endsWith("/.codex/auth.json")) {
    return "codex_auth";
  }
  return "unknown";
}

export function normalizeTokenRecord(raw, sourcePath) {
  const access = raw && (raw.access || raw.access_token || (raw.tokens && (raw.tokens.access_token || raw.tokens.access)));
  const accountId = raw && (raw.account_id || raw.accountId || (raw.tokens && (raw.tokens.account_id || raw.tokens.accountId)));

  if (!access || !accountId) {
    throw new Error("Unsupported token format");
  }

  return {
    access,
    account_id: accountId,
    expires: deriveTokenExpiry(raw, access),
    source_path: sourcePath || "",
    source_type: detectTokenSourceType(sourcePath),
  };
}

function getNodeModule(name) {
  try {
    if (typeof window !== "undefined" && window.reqnode) {
      return window.reqnode(name);
    }
  } catch (_) {}

  try {
    if (typeof require === "function") {
      return require(name);
    }
  } catch (_) {}

  return null;
}

export function readFileText(filePath) {
  const fs = getNodeModule("fs");
  if (!fs || !filePath) {
    return null;
  }

  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_) {
    return null;
  }
}

export function getOAuthStatus(settings) {
  const candidatePaths = getTokenCandidatePaths(settings);
  let firstProblem = null;

  for (const candidatePath of candidatePaths) {
    const rawText = readFileText(candidatePath);
    if (!rawText) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (_) {
      if (!firstProblem) {
        firstProblem = {
          ok: false,
          state: "invalid",
          message: "OAuth token file format is not supported.",
          sourcePath: candidatePath,
        };
      }
      continue;
    }

    let token;
    try {
      token = normalizeTokenRecord(parsed, candidatePath);
    } catch (_) {
      if (!firstProblem) {
        firstProblem = {
          ok: false,
          state: "invalid",
          message: "OAuth token file format is not supported.",
          sourcePath: candidatePath,
        };
      }
      continue;
    }

    if (token.expires && Date.now() > token.expires) {
      if (!firstProblem) {
        firstProblem = {
          ok: false,
          state: "expired",
          message: "OAuth token expired. Please log in again.",
          sourcePath: candidatePath,
        };
      }
      continue;
    }

    return {
      ok: true,
      state: "connected",
      message: "Connected",
      token,
      sourcePath: candidatePath,
    };
  }

  return firstProblem || {
    ok: false,
    state: "missing",
    message: "No OAuth token found in the common Windows paths.",
  };
}

export function readToken(settings) {
  const status = getOAuthStatus(settings);
  return status.ok ? status.token : null;
}
