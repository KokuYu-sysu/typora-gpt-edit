const { Plugin, PluginSettings, Notice } = window[Symbol.for("typora-plugin-core@v2")];

import { callAi, abortCurrentRequest } from "./api.js";
import { DEFAULT_SETTINGS, mergeSettings, shortcutMatches } from "./config.js";
import { EditorSelectionController } from "./editor.js";
import { AiEditSettingTab } from "./settings-tab.js";
import { ensureStyles, removeStyles, showToast, openContextMenu, closeContextMenu, promptForText, createStreamDialog, closeAnyDialog } from "./ui.js";

export default class AiEditPlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.editorSelection = new EditorSelectionController();
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  async onload() {
    this.registerSettings(
      new PluginSettings(this.app, this.manifest, { version: 1 }),
    );
    this.settings.setDefault(DEFAULT_SETTINGS);
    this.registerSettingTab(new AiEditSettingTab(this));
    ensureStyles();
    document.addEventListener("contextmenu", this.handleContextMenu, true);
    document.addEventListener("keydown", this.handleKeyDown, true);
    new Notice("AI Edit loaded. Select text and right-click to revise, or press Ctrl+E for Q&A.");
  }

  onunload() {
    document.removeEventListener("contextmenu", this.handleContextMenu, true);
    document.removeEventListener("keydown", this.handleKeyDown, true);
    abortCurrentRequest();
    closeContextMenu();
    closeAnyDialog();
    removeStyles();
  }

  getSettings() {
    return mergeSettings({
      provider: this.settings.get("provider"),
      model: this.settings.get("model"),
      oauthTokenPath: this.settings.get("oauthTokenPath"),
      openaiCompat: this.settings.get("openaiCompat"),
      shortcut: this.settings.get("shortcut"),
      prompts: this.settings.get("prompts"),
    });
  }

  saveSettings(patch) {
    const next = mergeSettings({ ...this.getSettings(), ...patch });
    this.settings.set("provider", next.provider);
    this.settings.set("model", next.model);
    this.settings.set("oauthTokenPath", next.oauthTokenPath);
    this.settings.set("openaiCompat", next.openaiCompat);
    this.settings.set("shortcut", next.shortcut);
    this.settings.set("prompts", next.prompts);
  }

  handleContextMenu(event) {
    if (!this.editorSelection.isEditorTarget(event.target)) {
      return;
    }

    const selection = this.editorSelection.getSelectedText().trim();
    if (!selection) {
      return;
    }

    this.editorSelection.captureSelection();
    event.preventDefault();
    event.stopImmediatePropagation();
    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: "AI Optimize Selection", value: "optimize" },
        { label: "AI Optimize (With Context)", value: "optimize_with_context" },
      ],
      onSelect: (value) => {
        if (value === "optimize") {
          this.openOptimizeFlow(false);
        }
        if (value === "optimize_with_context") {
          this.openOptimizeFlow(true);
        }
      },
    });
  }

  handleKeyDown(event) {
    const settings = this.getSettings();
    if (!shortcutMatches(event, settings.shortcut)) {
      return;
    }
    if (!this.editorSelection.isEditorTarget(event.target)) {
      return;
    }
    if (this.editorSelection.getSelectedText().trim()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.editorSelection.captureInsertionTarget();
    this.openQaFlow();
  }

  async openOptimizeFlow(withContext) {
    const selectedText = this.editorSelection.getSavedText() || this.editorSelection.getSelectedText();
    if (!selectedText.trim()) {
      showToast("Please select text first.", "error");
      return;
    }

    const extraPrompt = await promptForText({
      title: withContext ? "AI Optimize With Context" : "AI Optimize Selection",
      label: "Additional instructions (optional)",
      placeholder: "For example: make the tone more formal; shorten it to 120 words.",
      confirmText: "Start",
    });
    if (extraPrompt === null) {
      return;
    }

    const settings = this.getSettings();
    const promptKey = withContext ? "optimize_with_context" : "optimize";
    const promptConfig = settings.prompts[promptKey];
    const documentText = withContext ? this.editorSelection.getDocumentText() : "";
    let userPrompt = promptConfig.user
      .replace(/\{selection\}/g, selectedText)
      .replace(/\{document\}/g, documentText);

    if (extraPrompt) {
      userPrompt = `${extraPrompt}\n\n${userPrompt}`;
    }

    const stream = createStreamDialog({
      title: withContext ? "AI Optimize With Context" : "AI Optimize Selection",
      waitingText: "Waiting for AI response...",
      onStop: () => abortCurrentRequest(),
    });

    try {
      const result = await callAi(promptConfig.system, userPrompt, settings, {
        onChunk: (chunk) => stream.append(chunk),
      });
      if (!result.trim()) {
        stream.showError("The model returned an empty response.");
        return;
      }
      stream.showCompleted({
        confirmText: "Replace",
        onConfirm: (value) => {
          const ok = this.editorSelection.restoreAndReplace(value);
          stream.close();
          showToast(ok ? "Selection replaced." : "Replace failed.", ok ? "success" : "error");
        },
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        stream.showCompleted({
          confirmText: "Replace",
          onConfirm: (value) => {
            const ok = this.editorSelection.restoreAndReplace(value);
            stream.close();
            showToast(ok ? "Selection replaced." : "Replace failed.", ok ? "success" : "error");
          },
        });
      } else {
        stream.showError(error?.message || "The request failed.");
      }
    }
  }

  async openQaFlow() {
    const question = await promptForText({
      title: "AI Q&A",
      label: "Enter your question",
      placeholder: "For example: suggest a stronger transition sentence for the current section.",
      confirmText: "Start",
    });
    if (!question) {
      return;
    }

    const includeContext = await promptForText({
      title: "AI Q&A",
      label: "Type YES to include the full document as context, or leave blank to answer without it.",
      placeholder: "YES",
      confirmText: "Continue",
    });
    if (includeContext === null) {
      return;
    }

    const settings = this.getSettings();
    const withContext = String(includeContext || "").trim().toLowerCase() === "yes";
    const promptKey = withContext ? "qa_with_context" : "qa";
    const promptConfig = settings.prompts[promptKey];
    const userPrompt = promptConfig.user
      .replace(/\{question\}/g, question)
      .replace(/\{document\}/g, withContext ? this.editorSelection.getDocumentText() : "");

    const stream = createStreamDialog({
      title: "AI Q&A",
      waitingText: "Waiting for AI response...",
      onStop: () => abortCurrentRequest(),
    });

    try {
      const result = await callAi(promptConfig.system, userPrompt, settings, {
        onChunk: (chunk) => stream.append(chunk),
      });
      if (!result.trim()) {
        stream.showError("The model returned an empty response.");
        return;
      }
      stream.showCompleted({
        confirmText: "Insert",
        onConfirm: (value) => {
          const ok = this.editorSelection.insertResponse(value);
          stream.close();
          showToast(ok ? "Response inserted." : "Insert failed.", ok ? "success" : "error");
        },
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        stream.showCompleted({
          confirmText: "Insert",
          onConfirm: (value) => {
            const ok = this.editorSelection.insertResponse(value);
            stream.close();
            showToast(ok ? "Response inserted." : "Insert failed.", ok ? "success" : "error");
          },
        });
      } else {
        stream.showError(error?.message || "The request failed.");
      }
    }
  }
}
