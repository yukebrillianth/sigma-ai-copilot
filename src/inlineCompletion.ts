import * as vscode from 'vscode';
import { getProviders, getInlineCompletionConfig } from './config';

const COMPLETION_SYSTEM_PROMPT =
  'You are a HOLE FILLER. You are provided with a file containing holes, formatted as \'{{HOLE}}\'. ' +
  'Your TASK is to complete with a string to replace this hole with, inside a <COMPLETION/> XML tag, including context-aware indentation, if needed. ' +
  'All completions MUST be truthful, accurate, well-written and correct.\n\n' +
  'IMPORTANT RULES:\n' +
  '- Output ONLY the completion inside <COMPLETION></COMPLETION> tags\n' +
  '- Do NOT include the {{HOLE}} marker in your completion\n' +
  '- Do NOT include any explanation, reasoning, or markdown\n' +
  '- Do NOT wrap code in ``` fences\n' +
  '- The completion should naturally continue from the prefix and connect to the suffix\n' +
  '- If the hole is mid-line, complete just that part\n' +
  '- Match the existing code style and indentation';

export class OAIInlineCompletionProvider implements vscode.InlineCompletionItemProvider {

  private abortController: AbortController | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | null> {

    const config = getInlineCompletionConfig();
    if (!config.enabled || !config.providerId || !config.modelId) {
      return null;
    }

    if (token.isCancellationRequested) { return null; }

    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
      const editor = vscode.window.activeTextEditor;
      if (editor && !editor.selection.isEmpty) { return null; }
    }

    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic && config.debounceMs > 0) {
      const shouldSkip = await this.debounce(config.debounceMs, token);
      if (shouldSkip) { return null; }
    }

    if (token.isCancellationRequested) { return null; }

    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    token.onCancellationRequested(() => this.abortController?.abort());

    const provider = getProviders().find(p => p.id === config.providerId);
    if (!provider) { return null; }

    const prefix = this.getPrefix(document, position, config.maxPrefixLines);
    const suffix = this.getSuffix(document, position, config.maxSuffixLines);
    const lang = document.languageId;

    try {
      const completion = await this.fetchCompletion(provider, config, prefix, suffix, lang, signal);
      if (!completion || token.isCancellationRequested) { return null; }

      let insertText = completion;
      let startPos = position;

      if (context.selectedCompletionInfo) {
        startPos = context.selectedCompletionInfo.range.start;
        insertText = context.selectedCompletionInfo.text + completion;
      }

      return [new vscode.InlineCompletionItem(
        insertText,
        new vscode.Range(startPos, position)
      )];
    } catch {
      return null;
    }
  }

  private debounce(ms: number, token: vscode.CancellationToken): Promise<boolean> {
    return new Promise(resolve => {
      if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
      this.debounceTimer = setTimeout(() => {
        resolve(token.isCancellationRequested);
      }, ms);
      token.onCancellationRequested(() => {
        if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
        resolve(true);
      });
    });
  }

  private getPrefix(document: vscode.TextDocument, position: vscode.Position, maxLines: number): string {
    const startLine = Math.max(0, position.line - maxLines);
    return document.getText(new vscode.Range(
      new vscode.Position(startLine, 0),
      position
    ));
  }

  private getSuffix(document: vscode.TextDocument, position: vscode.Position, maxLines: number): string {
    const endLine = Math.min(document.lineCount - 1, position.line + maxLines);
    return document.getText(new vscode.Range(
      position,
      document.lineAt(endLine).range.end
    ));
  }

  private async fetchCompletion(
    provider: ReturnType<typeof getProviders>[number],
    config: ReturnType<typeof getInlineCompletionConfig>,
    prefix: string,
    suffix: string,
    lang: string,
    signal: AbortSignal
  ): Promise<string | null> {
    const url = `${provider.baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: config.modelId,
      messages: [
        { role: 'system', content: COMPLETION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `<FILE language="${lang}">\n${prefix}{{HOLE}}${suffix}\n</FILE>\n\nFill the {{HOLE}} with the correct completion. Reply with <COMPLETION>your code</COMPLETION> only.`
        }
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stop: config.stopSequences,
      stream: false,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) { return null; }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = json.choices?.[0]?.message?.content;
    if (!raw) { return null; }

    const tagMatch = raw.match(/<COMPLETION>([\s\S]*?)<\/COMPLETION>/);
    if (tagMatch) {
      return tagMatch[1];
    }

    return raw
      .replace(/^[\s\S]*?```[\w]*\n?/, '')
      .replace(/\n?```[\s\S]*$/, '')
      .replace(/^[\s\S]*?\n(?=\S)/, '')
      .trimEnd();
  }
}
