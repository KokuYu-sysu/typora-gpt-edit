const localeIsChinese = typeof navigator !== "undefined" && /^zh/i.test(
  (navigator.language || (navigator.languages && navigator.languages[0]) || "en")
);

export const CHATGPT_MODEL_PRESETS = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5",
  "gpt-5-mini",
  "o4-mini",
];

export const OPENAI_COMPAT_MODEL_PRESETS = [
  "gpt-5.4-mini",
  "gpt-5.4",
  "gpt-4.1",
  "gpt-4o-mini",
];

function normalizeCompatBackups(rawBackups) {
  if (!Array.isArray(rawBackups)) {
    return [];
  }
  return rawBackups.map((item) => ({
    name: String(item?.name || "").trim(),
    baseUrl: String(item?.baseUrl || "").trim(),
    apiKey: String(item?.apiKey || "").trim(),
    model: String(item?.model || "").trim(),
  }));
}

function createDefaultPrompts(isChinese = localeIsChinese) {
  if (isChinese) {
    return {
      optimize: {
        system: "你是一位专业学术写作编辑，擅长在不改变原意的前提下提升文字的准确性、流畅度和正式程度。",
        user: "请优化下面这段文字。保留原意，提升表达质量。只返回优化后的正文，不要解释。\n\n{selection}",
      },
      optimize_with_context: {
        system: "你是一位专业学术写作编辑，擅长结合全文语境优化局部段落，使术语、风格和逻辑保持一致。",
        user: "以下是完整文档：\n\n<document>\n{document}\n</document>\n\n请优化下面选中的内容，并保持与全文一致。只返回优化后的正文，不要解释。\n\n<selection>\n{selection}\n</selection>",
      },
      qa: {
        system: "你是一位论文写作助手。请直接回答用户问题，并使用纯文本，不要使用 Markdown 标记。",
        user: "{question}",
      },
      qa_with_context: {
        system: "你是一位论文写作助手。请结合用户当前正在编辑的完整文档来回答问题，并使用纯文本，不要使用 Markdown 标记。",
        user: "完整文档：\n\n<document>\n{document}\n</document>\n\n用户问题：\n{question}",
      },
      image_qa: {
        system: "你是一位图像解读与学术写作助手。请基于图像内容准确回答问题，若信息不足请明确说明。",
        user: "请根据这张图片回答问题。只输出答案正文，不要添加多余说明。\n\n问题：{question}",
      },
    };
  }

  return {
    optimize: {
      system: "You are a professional academic editor. Improve clarity, fluency, and formality without changing the meaning.",
      user: "Please improve the following text. Keep the original meaning and return only the revised passage.\n\n{selection}",
    },
    optimize_with_context: {
      system: "You are a professional academic editor. Improve a local passage while keeping terminology, style, and logic consistent with the full document.",
      user: "Here is the full document:\n\n<document>\n{document}\n</document>\n\nPlease improve the selected passage and keep it consistent with the document. Return only the revised passage.\n\n<selection>\n{selection}\n</selection>",
    },
    qa: {
      system: "You are a writing assistant for academic papers. Answer in plain text without Markdown formatting.",
      user: "{question}",
    },
    qa_with_context: {
      system: "You are a writing assistant for academic papers. Use the current document as context and answer in plain text without Markdown formatting.",
      user: "Full document:\n\n<document>\n{document}\n</document>\n\nUser question:\n{question}",
    },
    image_qa: {
      system: "You are an image interpretation and writing assistant. Answer accurately based on the image and clearly state uncertainty when needed.",
      user: "Answer the question based on this image. Return only the answer text.\n\nQuestion: {question}",
    },
  };
}

export const DEFAULT_SETTINGS = {
  provider: "chatgpt",
  model: "gpt-5.4",
  oauthTokenPath: "",
  oauthUserInfoPath: "",
  promptExportPath: "",
  openaiCompatFailoverEnabled: true,
  openaiCompatPreferredConnection: "primary",
  openaiCompatBackups: [
    { name: "Backup 1", baseUrl: "", apiKey: "", model: "" },
    { name: "Backup 2", baseUrl: "", apiKey: "", model: "" },
  ],
  openaiCompat: {
    baseUrl: "",
    apiKey: "",
    model: "gpt-5.4-mini",
  },
  shortcut: {
    key: "e",
    ctrlKey: true,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  },
  prompts: createDefaultPrompts(),
};

export function mergeSettings(raw = {}) {
  const prompts = raw.prompts || {};
  const normalizedBackups = normalizeCompatBackups(raw.openaiCompatBackups);
  const preferredConnection = String(raw.openaiCompatPreferredConnection || DEFAULT_SETTINGS.openaiCompatPreferredConnection);
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    openaiCompat: {
      ...DEFAULT_SETTINGS.openaiCompat,
      ...(raw.openaiCompat || {}),
    },
    openaiCompatFailoverEnabled: raw.openaiCompatFailoverEnabled !== undefined
      ? !!raw.openaiCompatFailoverEnabled
      : DEFAULT_SETTINGS.openaiCompatFailoverEnabled,
    openaiCompatPreferredConnection: [
      "primary",
      "backup_1",
      "backup_2",
    ].includes(preferredConnection) ? preferredConnection : DEFAULT_SETTINGS.openaiCompatPreferredConnection,
    openaiCompatBackups: normalizedBackups.length > 0
      ? normalizedBackups
      : DEFAULT_SETTINGS.openaiCompatBackups.map((x) => ({ ...x })),
    shortcut: {
      ...DEFAULT_SETTINGS.shortcut,
      ...(raw.shortcut || {}),
    },
    prompts: {
      ...DEFAULT_SETTINGS.prompts,
      ...prompts,
      optimize: {
        ...DEFAULT_SETTINGS.prompts.optimize,
        ...(prompts.optimize || {}),
      },
      optimize_with_context: {
        ...DEFAULT_SETTINGS.prompts.optimize_with_context,
        ...(prompts.optimize_with_context || {}),
      },
      qa: {
        ...DEFAULT_SETTINGS.prompts.qa,
        ...(prompts.qa || {}),
      },
      qa_with_context: {
        ...DEFAULT_SETTINGS.prompts.qa_with_context,
        ...(prompts.qa_with_context || {}),
      },
      image_qa: {
        ...DEFAULT_SETTINGS.prompts.image_qa,
        ...(prompts.image_qa || {}),
      },
    },
  };
}

export function shortcutMatches(event, shortcut) {
  if (!shortcut || !event || !event.key) {
    return false;
  }

  return (
    String(event.key).toLowerCase() === String(shortcut.key).toLowerCase()
    && !!event.ctrlKey === !!shortcut.ctrlKey
    && !!event.shiftKey === !!shortcut.shiftKey
    && !!event.altKey === !!shortcut.altKey
    && !!event.metaKey === !!shortcut.metaKey
  );
}

export function formatShortcut(shortcut) {
  if (!shortcut) {
    return "";
  }

  const parts = [];
  if (shortcut.ctrlKey) parts.push("Ctrl");
  if (shortcut.altKey) parts.push("Alt");
  if (shortcut.shiftKey) parts.push("Shift");
  if (shortcut.metaKey) parts.push("Meta");
  parts.push(String(shortcut.key || "").toUpperCase());
  return parts.join("+");
}
