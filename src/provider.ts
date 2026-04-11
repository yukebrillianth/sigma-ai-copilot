/**
 * provider.ts
 *
 * Implements the VS Code LanguageModelChatProvider interface.
 *
 * A single instance of OpenAICompatChatProvider is registered with VS Code.
 * It exposes ALL models from ALL configured providers under the single vendor
 * "openai-compat-provider". Each LanguageModelChatInformation ID is prefixed
 * with the provider ID so we can route requests to the correct base URL:
 *
 *   id = "<providerId>/<modelId>"   e.g.  "nvidia-nim/meta/llama-3.1-8b-instruct"
 *
 * When a chat request arrives, we split that compound ID, look up the provider
 * config, and forward the request to the correct OpenAI-compatible endpoint
 * using native fetch with streaming (SSE / application/x-ndjson).
 */

import * as vscode from 'vscode';
import { getProviders } from './config';
import { OpenAIStreamChunk, ProviderConfig } from './types';

/** Separator between provider ID and model ID in the compound LM id */
const ID_SEP = '::';

export class OpenAICompatChatProvider implements vscode.LanguageModelChatProvider {

  // ─────────────────────────────────────────────────────────────────────────
  // provideLanguageModelChatInformation
  // Called by VS Code whenever it needs to (re-)discover available models.
  // ─────────────────────────────────────────────────────────────────────────

  async provideLanguageModelChatInformation(
    options: { silent: boolean },
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatInformation[]> {

    const providers = getProviders();

    // In silent mode VS Code doesn't want us to show any UI.
    // We still return all models that are fully configured.
    if (options.silent) {
      return this.buildModelList(providers);
    }

    // In interactive mode: warn the user if they have no providers configured.
    if (providers.length === 0) {
      vscode.window.showInformationMessage(
        'No OpenAI-compatible providers configured. Use "OpenAI-Compat: Add New Provider" to get started.',
        'Manage Providers'
      ).then(choice => {
        if (choice === 'Manage Providers') {
          vscode.commands.executeCommand('openai-compat-provider.manage');
        }
      });
    }

    return this.buildModelList(providers);
  }

  /** Build the flat list of LanguageModelChatInformation for all providers / models */
  private buildModelList(providers: ReturnType<typeof getProviders>): vscode.LanguageModelChatInformation[] {
    const result: vscode.LanguageModelChatInformation[] = [];

    for (const provider of providers) {
      for (const model of provider.models) {
        result.push({
          // Compound ID encodes both provider and model so we can route later
          id: `${provider.id}${ID_SEP}${model.id}`,
          // Name shown in the Copilot model picker
          name: `${model.name} (${provider.displayName})`,
          // Family/version are informational strings
          family: provider.displayName,
          version: '1.0.0',
          maxInputTokens: model.maxInputTokens,
          maxOutputTokens: model.maxOutputTokens,
          detail: `via ${provider.baseUrl}`,
          tooltip: `Provider: ${provider.displayName}\nBase URL: ${provider.baseUrl}\nModel ID: ${model.id}`,
          capabilities: {
            toolCalling: model.supportsToolCalling,
          },
        });
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // provideLanguageModelChatResponse
  // The main handler: convert messages → call API → stream back to VS Code.
  // ─────────────────────────────────────────────────────────────────────────

  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {

    // ── 1. Resolve the provider config from the compound model ID ──────────
    const { provider, modelId } = this.resolveProvider(model.id);
    if (!provider) {
      throw new Error(
        `Provider not found for model "${model.id}". ` +
        `Please check your openai-compat-provider.providers settings.`
      );
    }

    // ── 2. Convert VS Code messages → OpenAI message format ───────────────
    const apiMessages = this.convertMessages(messages);

    // ── 3. Build the fetch request ─────────────────────────────────────────
    const requestUrl = `${provider.baseUrl}/chat/completions`;
    const requestBody: any = {
      model: modelId,
      messages: apiMessages,
      stream: true,           // Request streaming SSE responses
      max_tokens: model.maxOutputTokens,
    };

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }
      }));
      if (options.toolMode === vscode.LanguageModelChatToolMode.Required) {
        requestBody.tool_choice = 'auto';
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };

    // Only add Authorization header if an API key is configured
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    // ── 4. AbortController for cancellation support ────────────────────────
    const abortController = new AbortController();
    const cancelSub = token.onCancellationRequested(() => abortController.abort());

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      // ── 5. Handle non-OK HTTP responses ──────────────────────────────────
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request to ${requestUrl} failed with status ${response.status}: ${errorText}`
        );
      }

      if (!response.body) {
        throw new Error('Response body is null – the server did not return a streaming body.');
      }

      // ── 6. Parse the SSE stream and report chunks to VS Code ──────────────
      await this.consumeSSEStream(response.body, progress, token);

    } catch (err) {
      // Re-throw cancellation errors as-is; wrap others with context
      if ((err as Error).name === 'AbortError') {
        throw new vscode.CancellationError();
      }
      throw err;
    } finally {
      cancelSub.dispose();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // provideTokenCount
  // Rough estimation: ~4 characters per token (OpenAI heuristic).
  // ─────────────────────────────────────────────────────────────────────────

  async provideTokenCount(
    _model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    _token: vscode.CancellationToken
  ): Promise<number> {
    const str = typeof text === 'string'
      ? text
      : text.content
        .filter((p): p is vscode.LanguageModelTextPart => p instanceof vscode.LanguageModelTextPart)
        .map(p => p.value)
        .join('');
    return Math.ceil(str.length / 4);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Split the compound id back into its provider and model parts,
   * then look up the provider configuration.
   */
  private resolveProvider(compoundId: string): { provider: ProviderConfig | undefined; modelId: string } {
    const sepIdx = compoundId.indexOf(ID_SEP);
    if (sepIdx === -1) {
      return { provider: undefined, modelId: compoundId };
    }
    const providerId = compoundId.substring(0, sepIdx);
    const modelId = compoundId.substring(sepIdx + ID_SEP.length);
    const provider = getProviders().find(p => p.id === providerId);
    return { provider, modelId };
  }

  /**
   * Convert VS Code LanguageModelChatRequestMessage[] to the OpenAI messages array,
   * including handling of ToolCalls and ToolResults.
   */
  private convertMessages(
    messages: readonly vscode.LanguageModelChatRequestMessage[]
  ): Array<any> {
    const result: any[] = [];
    const toolCallIdToName: Record<string, string> = {};

    for (const msg of messages) {
      const role = msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant';

      let textContent = '';
      const toolCalls: any[] = [];
      const toolResults: any[] = [];

      for (const part of msg.content) {
        if (part instanceof vscode.LanguageModelTextPart) {
          textContent += part.value;
        } else if (part instanceof vscode.LanguageModelToolCallPart) {
          toolCallIdToName[part.callId] = part.name;
          toolCalls.push({
            id: part.callId,
            type: 'function',
            function: {
              name: part.name,
              arguments: typeof part.input === 'string' ? part.input : JSON.stringify(part.input)
            }
          });
        } else if (part instanceof vscode.LanguageModelToolResultPart) {
          let resultStr = '';
          for (const resPart of part.content) {
            if (resPart instanceof vscode.LanguageModelTextPart) {
              resultStr += resPart.value;
            } else if (typeof resPart === 'string') {
              resultStr += resPart;
            } else {
              try { resultStr += JSON.stringify(resPart); } catch { }
            }
          }
          const tr: any = {
            role: 'tool',
            tool_call_id: part.callId,
            content: resultStr || 'Success'
          };
          if (toolCallIdToName[part.callId]) {
            tr.name = toolCallIdToName[part.callId];
          }
          toolResults.push(tr);
        }
      }

      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          result.push(tr);
        }
      }

      if (textContent || toolCalls.length > 0 || toolResults.length === 0) {
        const apiMsg: any = { role, content: textContent || null };
        if (toolCalls.length > 0) {
          apiMsg.tool_calls = toolCalls;
        }
        // Avoid pushing empty assistant messages unless necessary or if no toolResults were mapped
        if (textContent || toolCalls.length > 0 || msg.role === vscode.LanguageModelChatMessageRole.User) {
          // Only skip empty assistant messages
          if (toolResults.length === 0 || textContent || toolCalls.length > 0) {
            if (msg.role !== vscode.LanguageModelChatMessageRole.User || toolResults.length === 0) {
              result.push(apiMsg);
            } else if (msg.role === vscode.LanguageModelChatMessageRole.User && textContent) {
              result.push(apiMsg);
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Read a streaming SSE (Server-Sent Events) body and report each text chunk
   * to VS Code via progress.report().
   *
   * The OpenAI streaming format sends lines like:
   *   data: {"choices":[{"delta":{"content":"Hello"}}]}
   * followed by a final:
   *   data: [DONE]
   */
  private async consumeSSEStream(
    body: ReadableStream<Uint8Array>,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const activeToolCalls: Record<number, { id: string; name: string; arguments: string }> = {};

    try {
      while (true) {
        // Check for VS Code cancellation before reading next chunk
        if (token.isCancellationRequested) { break; }

        const { done, value } = await reader.read();
        if (done) { break; }

        // Decode the raw bytes and append to our line buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines delimited by newline
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          // SSE data lines start with "data: "
          if (!trimmed.startsWith('data: ')) { continue; }
          const data = trimmed.slice('data: '.length);

          // The stream is done
          if (data === '[DONE]') { return; }

          try {
            const chunk: OpenAIStreamChunk = JSON.parse(data);
            const delta = chunk.choices?.[0]?.delta;

            if (delta?.content) {
              // Report each text fragment back to VS Code / Copilot Chat
              progress.report(new vscode.LanguageModelTextPart(delta.content));
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!activeToolCalls[idx]) {
                  activeToolCalls[idx] = { id: tc.id || `call_${idx}`, name: tc.function?.name || '', arguments: '' };
                }
                if (tc.function?.arguments) {
                  activeToolCalls[idx].arguments += tc.function.arguments;
                }
              }
            }
          } catch {
            // Malformed JSON line – skip it silently; don't break the stream
          }
        }
      }
    } finally {
      // Flush buffered tool calls
      for (const key of Object.keys(activeToolCalls)) {
        const tc = activeToolCalls[Number(key)];
        let inputObj = {};
        if (tc.arguments) {
          try { inputObj = JSON.parse(tc.arguments); } catch { }
        }
        progress.report(new vscode.LanguageModelToolCallPart(tc.id, tc.name, inputObj));
      }
      // Ensure the reader is always released
      reader.releaseLock();
    }
  }
}
