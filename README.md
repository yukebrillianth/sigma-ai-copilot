# Sigma AI Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Connect any **OpenAI-compatible API endpoint** to **GitHub Copilot Chat** and **inline code completion** — using the VS Code `LanguageModelChatProvider` API.

Bring models from any OpenAI-format API into the Copilot Chat model picker and get inline completions powered by your own models.

---

## Features

- **Multiple providers** — configure as many API endpoints as you need
- **Vision support** — send images to models that support it (e.g. Claude, GPT-4o)
- **Tool calling** — full function/tool call support
- **System prompt injection** — configurable per-provider, prevents 400 errors on APIs that require `role: system`
- **Model options forwarding** — `reasoning_effort`, `temperature`, and any other params forwarded to the API
- **Extra params per model** — set `reasoning_effort: "high"` or any custom params in settings
- **Inline code completion** — ghost text autocomplete using your own models
- **Streaming** — responses stream token-by-token via SSE
- **Auto-visible models** — models appear in the Copilot model picker without manual unhiding

---

## Install

Download `oai-provider-x.x.x.vsix` from [**Releases**](https://github.com/yukebrillianth/sigma-ai-copilot/releases/latest), then:

```bash
code --install-extension oai-provider-x.x.x.vsix
```

For **Remote SSH**, copy the VSIX to your server and install:

```bash
code --install-extension ~/oai-provider-x.x.x.vsix
```

Or in VS Code: `Cmd+Shift+P` → `Extensions: Install from VSIX...`

**From source:**

```bash
git clone https://github.com/yukebrillianth/sigma-ai-copilot.git
cd sigma-ai-copilot
npm install && npm run compile
```

Then symlink to VS Code extensions:

```bash
ln -s "$(pwd)" ~/.vscode/extensions/oai-provider
```

---

## Configuration

Open **Settings JSON** (`Cmd+Shift+P` → `Preferences: Open User Settings (JSON)`) and add:

### Provider & Models

```jsonc
"openai-compat-provider.providers": [
  {
    "id": "my-provider",
    "displayName": "My Provider",
    "baseUrl": "https://api.example.com/v1",
    "apiKey": "your-api-key",
    "defaultSystemPrompt": "You are a helpful assistant.",
    "models": [
      {
        "id": "claude-opus-4.6",
        "name": "Claude Opus 4.6",
        "maxInputTokens": 200000,
        "maxOutputTokens": 32000,
        "supportsToolCalling": true,
        "supportsVision": true,
        "extraParams": {
          "reasoning_effort": "high"
        }
      }
    ]
  }
]
```

| Field | Description |
|---|---|
| `id` | Unique slug, no spaces |
| `displayName` | Shown in the model picker |
| `baseUrl` | OpenAI-compatible API base URL |
| `apiKey` | Bearer token (leave empty if not needed) |
| `defaultSystemPrompt` | Injected as `role: system` first message. Required by some APIs to avoid 400 errors |
| `models[].id` | Model ID as the API expects it |
| `models[].name` | Display name in Copilot picker |
| `models[].maxInputTokens` | Max input context tokens |
| `models[].maxOutputTokens` | Max output tokens |
| `models[].supportsToolCalling` | Enable tool/function calling |
| `models[].supportsVision` | Enable image input support |
| `models[].extraParams` | Extra params merged into every API request (e.g. `reasoning_effort`, `temperature`) |

### Inline Completion

```jsonc
"openai-compat-provider.inlineCompletion": {
  "enabled": true,
  "providerId": "my-provider",
  "modelId": "claude-opus-4.6",
  "maxTokens": 256,
  "temperature": 0.01,
  "stopSequences": ["\n\n"],
  "debounceMs": 300,
  "maxPrefixLines": 100,
  "maxSuffixLines": 30
}
```

| Field | Default | Description |
|---|---|---|
| `enabled` | `false` | Enable inline code completion |
| `providerId` | | Provider ID to use (must match a configured provider) |
| `modelId` | | Model ID to use for completions |
| `maxTokens` | `256` | Max tokens per completion |
| `temperature` | `0.01` | Sampling temperature (low = deterministic) |
| `stopSequences` | `["\n\n"]` | Stop sequences to end generation |
| `debounceMs` | `300` | Delay after typing before requesting completion |
| `maxPrefixLines` | `100` | Lines of context before cursor |
| `maxSuffixLines` | `30` | Lines of context after cursor |

---

## Commands

Type `OAIProvider` in the Command Palette:

| Command | Description |
|---|---|
| `OAIProvider: Manage Providers` | Main hub — all actions in one place |
| `OAIProvider: Add Provider` | Register a new API endpoint |
| `OAIProvider: Remove Provider` | Delete a provider and all its models |
| `OAIProvider: Add Model` | Add a model to an existing provider |
| `OAIProvider: Remove Model` | Remove a model from a provider |
| `OAIProvider: List Providers` | View all configured providers & models |

---

## Compatible Providers

| Provider | Base URL |
|---|---|
| **NVIDIA NIM** | `https://integrate.api.nvidia.com/v1` |
| **Ollama** | `http://localhost:11434/v1` |
| **LM Studio** | `http://localhost:1234/v1` |
| **vLLM** | `http://your-server/v1` |
| **Together AI** | `https://api.together.xyz/v1` |
| **Groq** | `https://api.groq.com/openai/v1` |
| **OpenRouter** | `https://openrouter.ai/api/v1` |
| **Mistral AI** | `https://api.mistral.ai/v1` |
| Any OpenAI-compatible | Must support `/chat/completions` with SSE streaming |

---

## Development

```bash
git clone https://github.com/yukebrillianth/sigma-ai-copilot.git
cd sigma-ai-copilot
npm install
```

| Command | Description |
|---|---|
| `npm run compile` | One-shot TypeScript build |
| `npm run watch` | Watch mode (rebuilds on save) |
| `F5` in VS Code | Launch Extension Development Host |

```
src/
├── extension.ts          # Activation, provider registration
├── provider.ts           # LanguageModelChatProvider (streaming, SSE, vision, tools)
├── inlineCompletion.ts   # InlineCompletionItemProvider (ghost text)
├── commands.ts           # Command handlers with step-by-step UI
├── config.ts             # Read/write helpers for VS Code settings
└── types.ts              # Shared TypeScript interfaces
```

---

## License

MIT — see [LICENSE](LICENSE) for details.

Based on [calganaygun/copilot-oai-provider](https://github.com/calganaygun/copilot-oai-provider).
