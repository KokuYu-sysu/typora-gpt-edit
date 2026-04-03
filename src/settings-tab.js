const { SettingTab, Notice } = window[Symbol.for("typora-plugin-core@v2")];

import { formatShortcut } from "./config.js";
import { getOAuthStatus } from "./platform.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class AiEditSettingTab extends SettingTab {
  constructor(plugin) {
    super();
    this.plugin = plugin;
  }

  get name() {
    return "AI Edit";
  }

  onload() {
    this.render();
  }

  render() {
    const settings = this.plugin.getSettings();
    const status = getOAuthStatus(settings);
    const container = this.containerEl || this.contentEl || this.tabContentEl;
    if (container.empty) {
      container.empty();
    } else {
      container.innerHTML = "";
    }

    container.innerHTML = `
      <h2>AI Edit</h2>
      <p class="ai-edit-setting-note">Use ${escapeHtml(formatShortcut(settings.shortcut))} for AI Q&amp;A. Selection rewrite is available from the editor right-click menu.</p>
      <div class="ai-edit-setting-grid">
        <div>
          <label for="ai-edit-provider">Provider</label>
          <select id="ai-edit-provider">
            <option value="chatgpt" ${settings.provider === "chatgpt" ? "selected" : ""}>ChatGPT OAuth Login</option>
            <option value="openai_compat" ${settings.provider === "openai_compat" ? "selected" : ""}>OpenAI Compatible</option>
          </select>
        </div>
        <div>
          <label for="ai-edit-model">ChatGPT Model</label>
          <input id="ai-edit-model" type="text" value="${escapeHtml(settings.model)}" />
        </div>
        <div>
          <label for="ai-edit-oauth-path">OAuth Token File Path</label>
          <input id="ai-edit-oauth-path" type="text" value="${escapeHtml(settings.oauthTokenPath || "")}" />
          <div class="ai-edit-setting-note">Auto-detect order: %APPDATA%/oauth-cli-kit/auth/codex.json, %LOCALAPPDATA%/oauth-cli-kit/auth/codex.json, %USERPROFILE%/.codex/auth.json</div>
          <div class="ai-edit-setting-status ${status.ok ? "ok" : "bad"}">${escapeHtml(status.ok ? `Connected (${status.sourcePath})` : status.message)}</div>
        </div>
        <div>
          <label for="ai-edit-compat-url">OpenAI Compatible Base URL</label>
          <input id="ai-edit-compat-url" type="text" value="${escapeHtml(settings.openaiCompat.baseUrl || "")}" />
        </div>
        <div>
          <label for="ai-edit-compat-key">OpenAI Compatible API Key</label>
          <input id="ai-edit-compat-key" type="password" value="${escapeHtml(settings.openaiCompat.apiKey || "")}" />
        </div>
        <div>
          <label for="ai-edit-compat-model">OpenAI Compatible Model</label>
          <input id="ai-edit-compat-model" type="text" value="${escapeHtml(settings.openaiCompat.model || "")}" />
        </div>
        <div>
          <label for="ai-edit-optimize-system">Optimize System Prompt</label>
          <textarea id="ai-edit-optimize-system" rows="3">${escapeHtml(settings.prompts.optimize.system)}</textarea>
        </div>
        <div>
          <label for="ai-edit-optimize-user">Optimize User Prompt</label>
          <textarea id="ai-edit-optimize-user" rows="4">${escapeHtml(settings.prompts.optimize.user)}</textarea>
        </div>
        <div>
          <label for="ai-edit-context-system">Context Optimize System Prompt</label>
          <textarea id="ai-edit-context-system" rows="3">${escapeHtml(settings.prompts.optimize_with_context.system)}</textarea>
        </div>
        <div>
          <label for="ai-edit-context-user">Context Optimize User Prompt</label>
          <textarea id="ai-edit-context-user" rows="4">${escapeHtml(settings.prompts.optimize_with_context.user)}</textarea>
        </div>
        <div>
          <label for="ai-edit-qa-system">Q&amp;A System Prompt</label>
          <textarea id="ai-edit-qa-system" rows="3">${escapeHtml(settings.prompts.qa.system)}</textarea>
        </div>
        <div>
          <label for="ai-edit-qa-user">Q&amp;A User Prompt</label>
          <textarea id="ai-edit-qa-user" rows="2">${escapeHtml(settings.prompts.qa.user)}</textarea>
        </div>
        <div>
          <label for="ai-edit-qa-context-system">Q&amp;A With Context System Prompt</label>
          <textarea id="ai-edit-qa-context-system" rows="3">${escapeHtml(settings.prompts.qa_with_context.system)}</textarea>
        </div>
        <div>
          <label for="ai-edit-qa-context-user">Q&amp;A With Context User Prompt</label>
          <textarea id="ai-edit-qa-context-user" rows="4">${escapeHtml(settings.prompts.qa_with_context.user)}</textarea>
        </div>
      </div>
      <div style="margin-top: 14px; display: flex; gap: 10px;">
        <button class="ai-edit-btn primary" id="ai-edit-save-settings">Save</button>
      </div>
    `;

    container.querySelector("#ai-edit-save-settings").addEventListener("click", () => {
      this.plugin.saveSettings({
        provider: container.querySelector("#ai-edit-provider").value,
        model: container.querySelector("#ai-edit-model").value.trim(),
        oauthTokenPath: container.querySelector("#ai-edit-oauth-path").value.trim(),
        openaiCompat: {
          baseUrl: container.querySelector("#ai-edit-compat-url").value.trim(),
          apiKey: container.querySelector("#ai-edit-compat-key").value.trim(),
          model: container.querySelector("#ai-edit-compat-model").value.trim(),
        },
        prompts: {
          optimize: {
            system: container.querySelector("#ai-edit-optimize-system").value,
            user: container.querySelector("#ai-edit-optimize-user").value,
          },
          optimize_with_context: {
            system: container.querySelector("#ai-edit-context-system").value,
            user: container.querySelector("#ai-edit-context-user").value,
          },
          qa: {
            system: container.querySelector("#ai-edit-qa-system").value,
            user: container.querySelector("#ai-edit-qa-user").value,
          },
          qa_with_context: {
            system: container.querySelector("#ai-edit-qa-context-system").value,
            user: container.querySelector("#ai-edit-qa-context-user").value,
          },
        },
      });
      this.render();
      new Notice("AI Edit settings saved.");
    });
  }
}
