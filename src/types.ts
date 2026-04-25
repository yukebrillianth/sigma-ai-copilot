/**
 * types.ts
 * 
 * Shared TypeScript types used across the extension.
 * These mirror the structure stored in VS Code settings under
 * "openai-compat-provider.providers".
 */

/** Represents a single model entry within a provider */
export interface ModelConfig {
  /** The model ID string as the API expects it (e.g. "nvidia/llama-3.1-nemotron-ultra-253b-v1") */
  id: string;
  /** Human-readable display name shown in the Copilot model picker */
  name: string;
  /** Maximum number of tokens the model can accept as input context */
  maxInputTokens: number;
  /** Maximum number of tokens the model can output */
  maxOutputTokens: number;
  /** Whether the model supports tool/function calling */
  supportsToolCalling: boolean;
  /** Whether the model supports vision/image input */
  supportsVision: boolean;
  /** Extra parameters merged into every API request body (e.g. reasoning_effort, temperature) */
  extraParams: Record<string, unknown>;
}

/** Represents a fully configured OpenAI-compatible provider entry */
export interface ProviderConfig {
  /** Unique slug identifier, no spaces (e.g. "nvidia-nim") */
  id: string;
  /** Human-readable provider name (e.g. "NVIDIA NIM") */
  displayName: string;
  /** Base URL of the OpenAI-compatible API endpoint (e.g. https://integrate.api.nvidia.com/v1) */
  baseUrl: string;
  /** API key for authentication; empty string if not needed */
  apiKey: string;
  /** Default system prompt injected as the first message; empty string to skip */
  defaultSystemPrompt: string;
  /** List of models registered for this provider */
  models: ModelConfig[];
}

/** Configuration for inline code completion */
export interface InlineCompletionConfig {
  enabled: boolean;
  /** Provider ID to use (must match a configured provider's id) */
  providerId: string;
  /** Model ID to use (must match a model id within the provider) */
  modelId: string;
  /** Max tokens for completion response */
  maxTokens: number;
  /** Sampling temperature (low = deterministic) */
  temperature: number;
  /** Stop sequences to end generation */
  stopSequences: string[];
  /** Debounce delay in ms before sending request after user stops typing */
  debounceMs: number;
  /** Max lines of context to send as prefix */
  maxPrefixLines: number;
  /** Max lines of context to send as suffix */
  maxSuffixLines: number;
}

/** The structure of one SSE data chunk from an OpenAI streaming API */
export interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
           name?: string;
           arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}
