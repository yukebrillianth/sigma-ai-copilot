# OAIProvider — OpenAI-Compatible Models in GitHub Copilot Chat

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/calgan.oai-provider?label=VS%20Code%20Marketplace&logo=visualstudiocode&color=blue)](https://marketplace.visualstudio.com/items?itemName=calgan.oai-provider)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**OAIProvider** is a VS Code extension that connects any **OpenAI-compatible API endpoint** to **GitHub Copilot Chat** as a fully integrated language model provider — using the official VS Code `LanguageModelChatProvider` API.

Use it to bring models from **NVIDIA NIM**, **Ollama**, **LM Studio**, **vLLM**, **Together AI**, or any other OpenAI-format API into the Copilot Chat model picker.

---

## ✨ Features

- 🔌 **Multiple providers** — configure as many API endpoints as you need
- 🤖 **Custom models** — add any model IDs (no auto-discovery; you're in full control)
- 📡 **Streaming** — responses stream token-by-token via SSE, just like native Copilot models
- 🔑 **Per-provider API keys** — each provider has its own credentials
- 🛠️ **Guided UI** — step-by-step command palette wizards; no JSON editing required
- 🔄 **Live updates** — model list refreshes automatically when settings change

---

## 📋 Requirements

| Requirement | Details |
|---|---|
| VS Code | **1.99.0 or newer** |
| GitHub Copilot | **Individual plan** (the `LanguageModelChatProvider` API is not available on Business/Enterprise plans) |
| API Endpoint | Any **OpenAI-compatible** REST API with `/chat/completions` support |

---

## 🚀 Quick Start

### 1 — Install the extension

**From the VS Code Marketplace (recommended):**

1. Open VS Code and go to the [**OAIProvider**](https://marketplace.visualstudio.com/items?itemName=calgan.oai-provider) page, or search for **OAIProvider** in the Extensions panel (`⇧⌘X`)
2. Click **Install**
3. Reload VS Code (`⇧⌘P` → **Developer: Reload Window**)

**From a VSIX file:**

1. Download `oai-provider-x.x.x.vsix` from [**Releases**](https://github.com/calganaygun/copilot-oai-provider/releases/latest)
2. Run in your terminal:
```bash
code --install-extension oai-provider-x.x.x.vsix
```
3. Reload VS Code

**From source:**
```bash
git clone https://github.com/calganaygun/copilot-oai-provider.git
cd copilot-oai-provider
npm install
npm run compile
# Press F5 inside VS Code to launch Extension Development Host
```

### 2 — Add a provider

Open the Command Palette (`⇧⌘P` on macOS / `Ctrl+Shift+P` on Windows/Linux):

```
OAIProvider: Add Provider
```

Follow the 4-step wizard:
1. **Display Name** — e.g. `NVIDIA NIM`
2. **Provider ID** — slug, no spaces, e.g. `nvidia-nim`
3. **Base URL** — e.g. `https://integrate.api.nvidia.com/v1`
4. **API Key** — your bearer token (masked input; leave empty if not needed)

### 3 — Add a model

```
OAIProvider: Add Model
```

1. Pick the provider you just created
2. Enter the **Model ID** as the API expects (e.g. `moonshotai/kimi-k2.5`)
3. Enter a **Display Name** shown in the Copilot picker (e.g. `Kimi K2.5`)
4. Set **max input tokens** (e.g. `131072`)
5. Choose whether the model supports **tool calling**

### 4 — Use in Copilot Chat

Open Copilot Chat → click the **model picker** → your model appears as:

> `Kimi K2.5 (NVIDIA NIM)`

Send a message and enjoy streaming inference from your custom endpoint! 🎉

---

## 🔧 All Commands

Type `OAIProvider` in the Command Palette to see all commands:

| Command | Description |
|---|---|
| `OAIProvider: Manage Providers` | Main hub — all actions in one place |
| `OAIProvider: Add Provider` | Register a new API endpoint |
| `OAIProvider: Remove Provider` | Delete a provider and all its models |
| `OAIProvider: Add Model` | Add a model to an existing provider |
| `OAIProvider: Remove Model` | Remove a model from a provider |
| `OAIProvider: List Providers` | View all configured providers & models |

---

## ⚙️ Configuration

All data is stored in `openai-compat-provider.providers` in VS Code's global settings. You can edit it directly in **Settings JSON** or via the guided commands above.

**Example `settings.json` snippet:**
```json
"openai-compat-provider.providers": [
  {
    "id": "nvidia-nim",
    "displayName": "NVIDIA NIM",
    "baseUrl": "https://integrate.api.nvidia.com/v1",
    "apiKey": "nvapi-xxxxxxxxxxxx",
    "models": [
      {
        "id": "moonshotai/kimi-k2.5",
        "name": "Kimi K2.5",
        "maxInputTokens": 131072,
        "maxOutputTokens": 8192,
        "supportsToolCalling": true
      },
      {
        "id": "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        "name": "Nemotron Ultra 253B",
        "maxInputTokens": 128000,
        "maxOutputTokens": 4096,
        "supportsToolCalling": true
      }
    ]
  },
  {
    "id": "ollama-local",
    "displayName": "Ollama (local)",
    "baseUrl": "http://localhost:11434/v1",
    "apiKey": "",
    "models": [
      {
        "id": "llama3.2",
        "name": "Llama 3.2 (local)",
        "maxInputTokens": 32000,
        "maxOutputTokens": 4096,
        "supportsToolCalling": false
      }
    ]
  }
]
```

---

## 🌐 Compatible Providers

| Provider | Base URL | Notes |
|---|---|---|
| **NVIDIA NIM** | `https://integrate.api.nvidia.com/v1` | Get key at [build.nvidia.com](https://build.nvidia.com) |
| **Ollama** | `http://localhost:11434/v1` | No key needed |
| **LM Studio** | `http://localhost:1234/v1` | No key needed |
| **vLLM** | your server URL + `/v1` | Optional key |
| **Together AI** | `https://api.together.xyz/v1` | |
| **Groq** | `https://api.groq.com/openai/v1` | |
| **OpenRouter** | `https://openrouter.ai/api/v1` | |
| **Mistral AI** | `https://api.mistral.ai/v1` | |
| **Any OpenAI-compat** | — | As long as it has `/chat/completions` with SSE streaming |

---

## 🏗️ How It Works

This extension uses the VS Code [`LanguageModelChatProvider`](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider) API to register itself as a first-class language model source. When Copilot Chat sends a message to one of the extension's models:

1. VS Code calls `provideLanguageModelChatResponse` with the conversation messages
2. The extension converts the VS Code message format to OpenAI's `{"role", "content"}` format
3. A `fetch` request is made to `<baseUrl>/chat/completions` with `stream: true`
4. The SSE response is parsed line-by-line and each chunk is reported back to VS Code via `progress.report(new LanguageModelTextPart(...))`
5. Copilot Chat renders the streaming response in real time

---

## 🛠️ Development

```bash
git clone https://github.com/calganaygun/copilot-oai-provider.git
cd copilot-oai-provider
npm install
```

| Command | Description |
|---|---|
| `npm run compile` | One-shot TypeScript build |
| `npm run watch` | Watch mode (rebuilds on save) |
| `F5` in VS Code | Launch Extension Development Host |

### Project Structure

```
src/
├── extension.ts   # Activation, provider registration, settings watcher
├── provider.ts    # LanguageModelChatProvider implementation (streaming, SSE)
├── commands.ts    # All 6 command handlers with step-by-step UI
├── config.ts      # Read/write helpers for VS Code settings
└── types.ts       # Shared TypeScript interfaces
```

---

## 🤝 Contributing

PRs and issues welcome! Please open an issue first for large changes.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
