# typora-plugin-ai-edit

`typora-plugin-ai-edit` is a Typora Community Plugin for paper writing on Windows. It brings AI-assisted editing into Typora without modifying Typora's installation files.

This Windows port focuses on a stable writing workflow:

- rewrite selected text from the right-click menu
- rewrite selected text with full-document context
- ask writing questions with `Ctrl + E`
- support ChatGPT OAuth token files on Windows
- support OpenAI-compatible APIs

## Features

Included: 

- `AI Optimize Selection`
- `AI Optimize (With Context)`
- `AI Q&A` via `Ctrl + E`
- settings page inside Typora Community Plugins
- Windows OAuth token auto-detection
- OpenAI-compatible API mode

## Requirements

- Windows 11
- Typora
- [typora-community-plugin](https://github.com/typora-community-plugin/typora-community-plugin)
- Node.js `>= 22` is recommended for development

## Installation

### 1. Install Typora Community Plugin Framework

Make sure the community plugin framework is already installed and working.

A common runtime directory is:

```text
C:\Users\<YourUser>\.typora\community-plugins
```

The plugin should be placed in:

```text
C:\Users\<YourUser>\.typora\community-plugins\plugins\typora-plugin-ai-edit
```

### 2. Copy or clone this plugin folder

You can either copy the folder manually or clone it directly into the framework's `plugins` directory.

```powershell
cd C:\Users\<YourUser>\.typora\community-plugins\plugins
git clone https://github.com/KokuYu-sysu/typora-gpt-edit.git typora-plugin-ai-edit
```

If you prefer manual installation, copy the entire `typora-plugin-ai-edit` folder into the framework's `plugins` directory.

### 3. Restart Typora

After restarting Typora:

1. Press `Ctrl + .`
2. Open `Community Plugins`
3. Enable `AI Edit`

![](.\asset\overview.png)

## Configuration

Open `Ctrl + .` -> `Community Plugins` -> `AI Edit`.

### Provider 1: ChatGPT OAuth Login

This mode reads an existing OAuth token file from your local machine.

Auto-detect order:

```text
%APPDATA%\oauth-cli-kit\auth\codex.json
%LOCALAPPDATA%\oauth-cli-kit\auth\codex.json
%USERPROFILE%\.codex\auth.json
```

You can also manually set `OAuth Token File Path` in the settings page.

### Provider 2: OpenAI Compatible

This mode uses:

- `Base URL`
- `API Key`
- `Model`

You can point it to OpenAI-compatible gateways or self-hosted backends.

## Usage

### Rewrite selected text

1. Select text in the editor
2. Right-click
3. Choose one of:
   - `AI Optimize Selection`
   - `AI Optimize (With Context)`

The plugin will show a result dialog. You can confirm to replace the selection.

![](.\asset\rightclick.png)

And it will return the revise suggestion, click `Replace` to do that:
![](.\asset\Revisement.png)

### Ask writing questions

1. Place the cursor in the editor without selecting text
2. Press `Ctrl + E`
3. Enter your question
4. Optionally type `YES` to include the full document as context

The answer can then be inserted into the document.

![](.\asset\AI_Q&A.PNG)

## Default behavior

- Right-click AI actions only appear when text is selected in the editor.
- `Ctrl + E` only triggers when no text is selected.
- Default prompts are optimized for academic writing.
- Chinese and English default prompts are chosen from the browser locale.

## Development notes

Main files:

- `main.js`
- `manifest.json`
- `src/plugin.js`
- `src/platform.js`
- `src/api.js`
- `src/settings-tab.js`
- `src/config.js`

Important implementation note:

- `manifest.json` must be saved as UTF-8 **without BOM**. The Typora plugin framework parses it with `JSON.parse(...)`, and a BOM can prevent the plugin from being discovered.

## Known limitations

- This project is currently tested for Windows-oriented community-plugin usage, for macOS: Please View: https://github.com/Aurisper/typora-ai-edit.
- The plugin depends on Typora Community Plugin Framework internals.
- ChatGPT OAuth support depends on the local token file format remaining compatible.
- The default prompt is set as Chinese, for English or other language document should revise the prompt by user. And you can also revise the prompt to make it more suitable to you.

## Publish package

The recommended GitHub upload/package directory is this plugin folder itself:

```text
typora-plugin-ai-edit/
```

Place that folder inside their Typora community plugin `plugins` directory.

## Acknowledge

In developing and implementing this project, I used another project, https://github.com/Aurisper/typora-ai-edit, as a reference and made revisions based on it. Therefore, I would like to express my sincere thanks to its contributor.

## License

MIT

