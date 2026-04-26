# Sigma AI Copilot — Setup Guide

## Installation

Download `oai-provider-x.x.x.vsix` from [Releases](https://github.com/yukebrillianth/sigma-ai-copilot/releases/latest).

```bash
code --install-extension oai-provider-x.x.x.vsix
```

For **VS Code Remote SSH**, copy the VSIX to your server first:

```bash
scp oai-provider-x.x.x.vsix user@your-server:~/
ssh user@your-server
code --install-extension ~/oai-provider-x.x.x.vsix
```

After installing, reload VS Code: `Cmd+Shift+P` → `Developer: Reload Window`.

---

## Configuration

Open **Settings JSON**: `Cmd+Shift+P` → `Preferences: Open User Settings (JSON)`.

### Full Example

```jsonc
{
  // ── Provider & Model Configuration ──────────────────────────────────────
  "openai-compat-provider.providers": [
    {
      "id": "sigma",
      "displayName": "Sigma",
      "baseUrl": "https://your-api-endpoint.example.com/v1",
      "apiKey": "your-api-key-here",
      "defaultSystemPrompt": "You are a helpful assistant. berfikirlah sebelum menjawab. Hindari ai slop dan em dash",
      "models": [
        {
          "id": "claude-opus-4.6",
          "name": "Claude Opus 4.6",
          "maxInputTokens": 400000,
          "maxOutputTokens": 32000,
          "supportsToolCalling": true,
          "supportsVision": true,
          "extraParams": {
            "reasoning_effort": "high"
          }
        }
      ]
    }
  ],

  // ── Inline Code Completion (Ghost Text) ─────────────────────────────────
  "openai-compat-provider.inlineCompletion": {
    "enabled": true,
    "providerId": "sigma",
    "modelId": "claude-opus-4.6",
    "maxTokens": 256,
    "temperature": 0.01,
    "stopSequences": ["\n\n"],
    "debounceMs": 300,
    "maxPrefixLines": 100,
    "maxSuffixLines": 30
  },

  // ── Set as Default Model for Copilot Agents ─────────────────────────────
  "chat.planAgent.defaultModel": "Claude Opus 4.6 (Sigma) (openai-compat-provider)",
  "inlineChat.defaultModel": "Claude Opus 4.6 (Sigma) (openai-compat-provider)",
  "chat.exploreAgent.defaultModel": "Claude Opus 4.6 (Sigma) (openai-compat-provider)",
  "github.copilot.chat.exploreAgent.model": "Claude Opus 4.6 (Sigma)",
  "github.copilot.chat.askAgent.model": "Claude Opus 4.6 (Sigma)",
  "github.copilot.chat.implementAgent.model": "Claude Opus 4.6 (Sigma)"
}
```

---

## Provider Settings Reference

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | Yes | | Unique slug identifier, no spaces (e.g. `sigma`) |
| `displayName` | string | Yes | | Human-readable name shown in the model picker |
| `baseUrl` | string | Yes | | OpenAI-compatible API base URL (e.g. `https://api.example.com/v1`) |
| `apiKey` | string | No | `""` | Bearer token for authentication. Leave empty if not needed |
| `defaultSystemPrompt` | string | No | `""` | Injected as `role: system` first message on every request. Set this if your API returns 400 without a system message |
| `models` | array | Yes | `[]` | List of models available from this provider |

## Model Settings Reference

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | Yes | | Model ID as the API expects (e.g. `claude-opus-4.6`) |
| `name` | string | Yes | | Display name in the Copilot model picker |
| `maxInputTokens` | number | No | `128000` | Maximum input context window in tokens |
| `maxOutputTokens` | number | No | `4096` | Maximum output tokens |
| `supportsToolCalling` | boolean | No | `true` | Whether the model supports tool/function calling |
| `supportsVision` | boolean | No | `false` | Whether the model supports image input |
| `extraParams` | object | No | `{}` | Extra parameters merged into every API request body |

### extraParams Examples

```jsonc
"extraParams": {
  "reasoning_effort": "high",  // "low", "medium", "high"
  "temperature": 0.7,
  "top_p": 0.9,
  "frequency_penalty": 0.5
}
```

Any key-value pair in `extraParams` is spread directly into the `/chat/completions` request body.

---

## Inline Completion Settings Reference

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Enable inline code completion (ghost text) |
| `providerId` | string | `""` | Provider ID to use (must match a configured provider's `id`) |
| `modelId` | string | `""` | Model ID to use (must match a model's `id` within the provider) |
| `maxTokens` | number | `256` | Maximum tokens per completion response |
| `temperature` | number | `0.01` | Sampling temperature. Lower = more deterministic |
| `stopSequences` | string[] | `["\n\n"]` | Stop sequences to end generation |
| `debounceMs` | number | `300` | Milliseconds to wait after typing before requesting a completion |
| `maxPrefixLines` | number | `100` | Lines of code context before cursor sent as prefix |
| `maxSuffixLines` | number | `30` | Lines of code context after cursor sent as suffix |

---

## Copilot Agent Model Settings

To set your model as the default for all Copilot agents, add these to your settings.json.

The model name format is: `{model name} ({provider displayName}) (openai-compat-provider)`

```jsonc
{
  // Copilot Chat (plan, explore, inline chat)
  "chat.planAgent.defaultModel": "Claude Opus 4.6 (Sigma) (openai-compat-provider)",
  "chat.exploreAgent.defaultModel": "Claude Opus 4.6 (Sigma) (openai-compat-provider)",
  "inlineChat.defaultModel": "Claude Opus 4.6 (Sigma) (openai-compat-provider)",

  // GitHub Copilot agents
  "github.copilot.chat.exploreAgent.model": "Claude Opus 4.6 (Sigma)",
  "github.copilot.chat.askAgent.model": "Claude Opus 4.6 (Sigma)",
  "github.copilot.chat.implementAgent.model": "Claude Opus 4.6 (Sigma)"
}
```

---

## Multiple Providers

You can configure multiple providers and models:

```jsonc
"openai-compat-provider.providers": [
  {
    "id": "sigma",
    "displayName": "Sigma",
    "baseUrl": "https://your-api-endpoint.example.com/v1",
    "apiKey": "your-api-key-here",
    "defaultSystemPrompt": "You are a helpful assistant.",
    "models": [
      {
        "id": "claude-opus-4.6",
        "name": "Claude Opus 4.6",
        "maxInputTokens": 400000,
        "maxOutputTokens": 32000,
        "supportsToolCalling": true,
        "supportsVision": true,
        "extraParams": { "reasoning_effort": "high" }
      }
    ]
  },
  {
    "id": "ollama",
    "displayName": "Ollama (local)",
    "baseUrl": "http://localhost:11434/v1",
    "apiKey": "",
    "defaultSystemPrompt": "",
    "models": [
      {
        "id": "llama3.2",
        "name": "Llama 3.2",
        "maxInputTokens": 32000,
        "maxOutputTokens": 4096,
        "supportsToolCalling": false,
        "supportsVision": false,
        "extraParams": {}
      }
    ]
  }
]
```

Each model appears separately in the Copilot Chat model picker.

---

## Commands

Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and type `OAIProvider`:

| Command | Description |
|---|---|
| `OAIProvider: Manage Providers` | Main hub — all actions in one place |
| `OAIProvider: Add Provider` | Step-by-step wizard to register a new API endpoint |
| `OAIProvider: Remove Provider` | Delete a provider and all its models |
| `OAIProvider: Add Model` | Add a model to an existing provider |
| `OAIProvider: Remove Model` | Remove a model from a provider |
| `OAIProvider: List Providers` | View all configured providers and models |

---

## Troubleshooting

### Model not showing in Copilot Chat picker

Reload VS Code: `Cmd+Shift+P` → `Developer: Reload Window`. Models should appear automatically without needing to unhide them.

### API returns 400 error

Set `defaultSystemPrompt` on your provider. Some APIs require a `role: system` message in every request.

```jsonc
"defaultSystemPrompt": "You are a helpful assistant."
```

### Inline completion not working

1. Make sure `enabled` is `true` in `openai-compat-provider.inlineCompletion`
2. Verify `providerId` and `modelId` match your configured provider and model
3. Check that the API endpoint is reachable

### Inline completion returns markdown or explanations

This is a known issue with chat models. The extension uses a strict "hole filler" prompt to minimize this, but some models may still occasionally include extra text. The extension strips `<COMPLETION>` tags and markdown fences automatically.
