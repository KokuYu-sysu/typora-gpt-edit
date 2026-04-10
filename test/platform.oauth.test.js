import assert from "node:assert/strict";

import {
  buildOpenAiOauthAuthorizeUrl,
  decodeOpenAiAccountIdFromAccessToken,
  normalizeOauthTokenResponse,
} from "../src/platform.js";

function toBase64UrlJson(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function testBuildAuthorizeUrl() {
  const url = buildOpenAiOauthAuthorizeUrl({
    state: "state-123",
    codeChallenge: "challenge-456",
  });
  const parsed = new URL(url);

  assert.equal(parsed.origin + parsed.pathname, "https://auth.openai.com/oauth/authorize");
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("redirect_uri"), "http://localhost:1455/auth/callback");
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  assert.equal(parsed.searchParams.get("code_challenge"), "challenge-456");
  assert.equal(parsed.searchParams.get("state"), "state-123");
  assert.equal(parsed.searchParams.get("originator"), "nanobot");
  assert.equal(parsed.searchParams.get("codex_cli_simplified_flow"), "true");
}

function testDecodeAccountId() {
  const header = toBase64UrlJson({ alg: "none", typ: "JWT" });
  const payload = toBase64UrlJson({
    "https://api.openai.com/auth": {
      chatgpt_account_id: "acct_abc123",
    },
  });
  const token = `${header}.${payload}.sig`;

  assert.equal(decodeOpenAiAccountIdFromAccessToken(token), "acct_abc123");
}

function testNormalizeTokenResponse() {
  const header = toBase64UrlJson({ alg: "none", typ: "JWT" });
  const payload = toBase64UrlJson({
    "https://api.openai.com/auth": {
      chatgpt_account_id: "acct_normalized",
    },
  });
  const accessToken = `${header}.${payload}.sig`;

  const normalized = normalizeOauthTokenResponse(
    {
      access_token: accessToken,
      refresh_token: "refresh_xyz",
      expires_in: 3600,
    },
    null,
    1700000000000,
  );

  assert.equal(normalized.access, accessToken);
  assert.equal(normalized.refresh, "refresh_xyz");
  assert.equal(normalized.account_id, "acct_normalized");
  assert.equal(normalized.expires, 1700003600000);
}

testBuildAuthorizeUrl();
testDecodeAccountId();
testNormalizeTokenResponse();

console.log("platform.oauth tests passed");
