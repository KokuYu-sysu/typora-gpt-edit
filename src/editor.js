export class EditorSelectionController {
  constructor() {
    this.savedRange = null;
    this.savedText = "";
    this.insertTarget = null;
  }

  isEditorTarget(node) {
    return !!(node && node.closest && (node.closest("#write") || node.closest(".CodeMirror")));
  }

  getSelectedText() {
    const selection = window.getSelection();
    return selection ? selection.toString() : "";
  }

  captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.clearSavedSelection();
      return false;
    }

    this.savedRange = selection.getRangeAt(0).cloneRange();
    this.savedText = selection.toString();
    this.captureInsertionTarget();
    return true;
  }

  captureInsertionTarget() {
    try {
      const selection = window.getSelection();
      const node = selection && (selection.focusNode || selection.anchorNode);
      const element = node && (node.nodeType === 1 ? node : node.parentElement);
      this.insertTarget = element && (element.closest("[cid]") || element.closest("p") || element.closest("li") || element.closest("h1,h2,h3,h4,h5,h6") || element);
    } catch (_) {
      this.insertTarget = null;
    }
  }

  getSavedText() {
    return this.savedText || "";
  }

  getDocumentText() {
    try {
      if (window.File && window.File.editor && typeof window.File.editor.getMarkdown === "function") {
        return window.File.editor.getMarkdown();
      }
    } catch (_) {}

    try {
      if (window.editor && typeof window.editor.getMarkdown === "function") {
        return window.editor.getMarkdown();
      }
    } catch (_) {}

    return "";
  }

  restoreAndReplace(nextText) {
    if (!this.savedRange) {
      return false;
    }

    try {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(this.savedRange);
      const ok = document.execCommand("insertText", false, nextText);
      this.clearSavedSelection();
      return !!ok;
    } catch (_) {
      this.clearSavedSelection();
      return false;
    }
  }

  insertResponse(text) {
    const payload = `\n\n${text}\n\n`;
    try {
      const selection = window.getSelection();
      const writeEl = document.getElementById("write");
      if (writeEl) {
        writeEl.focus();
      }

      if (this.insertTarget && this.insertTarget.parentNode) {
        const range = document.createRange();
        range.setStartAfter(this.insertTarget);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      const ok = document.execCommand("insertText", false, payload);
      if (!ok) {
        throw new Error("insertText failed");
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  clearSavedSelection() {
    this.savedRange = null;
    this.savedText = "";
  }
}
