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
  /** List of models registered for this provider */
  models: ModelConfig[];
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
    };
    finish_reason: string | null;
  }>;
}
