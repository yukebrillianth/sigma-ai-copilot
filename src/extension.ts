/**
 * extension.ts
 *
 * Extension entry-point. Called by VS Code when the extension activates.
 *
 * Activation trigger: "onStartupFinished" (declared in package.json) so the
 * provider is always available as soon as VS Code is ready, without requiring
 * the user to open a specific file type first.
 *
 * Responsibilities:
 *   1. Register the LanguageModelChatProvider with VS Code's LM API.
 *   2. Register all management commands.
 *   3. Listen for settings changes and notify VS Code when the model list changes.
 */

import * as vscode from 'vscode';
import { OpenAICompatChatProvider } from './provider';
import { registerCommands } from './commands';

/** The vendor ID must exactly match the "vendor" field in package.json contributes */
const VENDOR_ID = 'openai-compat-provider';

export function activate(context: vscode.ExtensionContext): void {
  console.log('[openai-compat-provider] Extension activating…');

  // ── 1. Instantiate and register the LM provider ─────────────────────────
  //
  // registerLanguageModelChatProvider returns a Disposable.
  // We store it in context.subscriptions so VS Code cleans it up on deactivation.
  const chatProvider = new OpenAICompatChatProvider();

  const providerDisposable = vscode.lm.registerLanguageModelChatProvider(
    VENDOR_ID,
    chatProvider
  );
  context.subscriptions.push(providerDisposable);

  // ── 2. Register all management commands ──────────────────────────────────
  registerCommands(context);

  // ── 3. Watch for settings changes ────────────────────────────────────────
  //
  // When the user edits the "openai-compat-provider.providers" setting
  // (either via our commands or manually in settings.json), we need to tell
  // VS Code to re-fetch the model list so the Copilot model picker is updated.
  //
  // The recommended pattern from the VS Code API is to call
  // vscode.lm.registerLanguageModelChatProvider again with the same vendor ID
  // (which forces a model-list refresh) OR to rely on the fact that VS Code
  // will call provideLanguageModelChatInformation again on next access.
  //
  // Here we simply notify the user when the setting changes so they know
  // they may need to re-open the Copilot Chat panel to see new models.
  const settingsWatcher = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('openai-compat-provider.providers')) {
      console.log('[openai-compat-provider] Provider settings changed – model list will refresh on next LM access.');
      // The onDidChangeConfiguration fires after our command-based saves too,
      // so no additional action is needed here. VS Code will call
      // provideLanguageModelChatInformation fresh when it next needs the list.
      
      // Show a subtle status-bar notification (not a popup) to indicate refresh
      const statusMsg = vscode.window.setStatusBarMessage(
        '$(sync~spin) OpenAI-Compat: model list updated',
        3000   // auto-dismiss after 3 seconds
      );
      context.subscriptions.push(statusMsg);
    }
  });
  context.subscriptions.push(settingsWatcher);

  console.log('[openai-compat-provider] Extension activated successfully.');
}

export function deactivate(): void {
  console.log('[openai-compat-provider] Extension deactivated.');
}
