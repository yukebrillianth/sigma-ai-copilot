/**
 * commands.ts
 *
 * Registers all user-facing commands contributed by this extension.
 * Each command is implemented as an interactive multi-step quick-pick / input-box
 * flow so the user never needs to hand-edit settings.json.
 *
 * Commands:
 *   openai-compat-provider.manage       – Main management hub (lists providers, routes to others)
 *   openai-compat-provider.addProvider  – Wizard to add a new provider
 *   openai-compat-provider.removeProvider – Pick and remove a provider
 *   openai-compat-provider.addModel     – Pick a provider, then add a model to it
 *   openai-compat-provider.removeModel  – Pick a provider + model, then delete the model
 *   openai-compat-provider.listProviders – Show a summary of all providers and their models
 */

import * as vscode from 'vscode';
import {
  getProviders,
  addProvider,
  removeProvider,
  addModel,
  removeModel,
} from './config';
import { ModelConfig } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Registration entry-point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register all commands and return their disposables so the extension host
 * can clean up on deactivation.
 */
export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('openai-compat-provider.manage',         cmdManage),
    vscode.commands.registerCommand('openai-compat-provider.addProvider',    cmdAddProvider),
    vscode.commands.registerCommand('openai-compat-provider.removeProvider', cmdRemoveProvider),
    vscode.commands.registerCommand('openai-compat-provider.addModel',       cmdAddModel),
    vscode.commands.registerCommand('openai-compat-provider.removeModel',    cmdRemoveModel),
    vscode.commands.registerCommand('openai-compat-provider.listProviders',  cmdListProviders),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Command implementations
// ─────────────────────────────────────────────────────────────────────────────

/** Management hub – shows a quick-pick menu with available actions */
async function cmdManage(): Promise<void> {
  const providers = getProviders();
  const totalModels = providers.reduce((acc, p) => acc + p.models.length, 0);

  const choice = await vscode.window.showQuickPick(
    [
      {
        label: '$(add) Add Provider',
        description: 'Register a new OpenAI-compatible API endpoint',
        action: 'add',
      },
      {
        label: '$(trash) Remove Provider',
        description: `Currently ${providers.length} provider(s) configured`,
        action: 'remove',
      },
      {
        label: '$(circuit-board) Add Model to Provider',
        description: 'Add a model ID to an existing provider',
        action: 'addModel',
      },
      {
        label: '$(close) Remove Model from Provider',
        description: `Currently ${totalModels} model(s) configured`,
        action: 'removeModel',
      },
      {
        label: '$(list-unordered) List All Providers & Models',
        description: 'Show a summary of the current configuration',
        action: 'list',
      },
      {
        label: '$(settings-gear) Open Settings JSON',
        description: 'Manually edit openai-compat-provider.providers',
        action: 'openSettings',
      },
    ],
    { placeHolder: 'OpenAI-Compatible Provider Management' }
  );

  if (!choice) { return; }

  switch (choice.action) {
    case 'add':        await cmdAddProvider();   break;
    case 'remove':     await cmdRemoveProvider(); break;
    case 'addModel':   await cmdAddModel();       break;
    case 'removeModel':await cmdRemoveModel();    break;
    case 'list':       await cmdListProviders();  break;
    case 'openSettings':
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'openai-compat-provider.providers'
      );
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Wizard: collect provider details and save */
async function cmdAddProvider(): Promise<void> {
  // ── Step 1: Display Name ──────────────────────────────────────────────────
  const displayName = await vscode.window.showInputBox({
    title: 'Add Provider (1/4) – Display Name',
    prompt: 'Enter a human-readable name for this provider',
    placeHolder: 'e.g. NVIDIA NIM',
    validateInput: v => v.trim() ? undefined : 'Display name cannot be empty',
  });
  if (!displayName) { return; }

  // ── Step 2: ID (slug) ─────────────────────────────────────────────────────
  const suggestedId = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const id = await vscode.window.showInputBox({
    title: 'Add Provider (2/4) – Provider ID',
    prompt: 'Unique identifier (no spaces). Used internally to route LM requests.',
    value: suggestedId,
    validateInput: v => {
      if (!v.trim()) { return 'ID cannot be empty'; }
      if (/\s/.test(v)) { return 'ID must not contain spaces'; }
      if (getProviders().some(p => p.id === v)) { return `Provider "${v}" already exists`; }
      return undefined;
    },
  });
  if (!id) { return; }

  // ── Step 3: Base URL ──────────────────────────────────────────────────────
  const baseUrl = await vscode.window.showInputBox({
    title: 'Add Provider (3/4) – Base URL',
    prompt: 'OpenAI-compatible API base URL (without trailing slash)',
    placeHolder: 'https://integrate.api.nvidia.com/v1',
    validateInput: v => {
      if (!v.trim()) { return 'Base URL cannot be empty'; }
      try { new URL(v); return undefined; }
      catch { return 'Enter a valid URL'; }
    },
  });
  if (!baseUrl) { return; }

  // ── Step 4: API Key (optional) ────────────────────────────────────────────
  const apiKey = await vscode.window.showInputBox({
    title: 'Add Provider (4/4) – API Key',
    prompt: 'API key / bearer token (leave empty if not required)',
    password: true,    // Masks the input
    placeHolder: 'nvapi-xxxx…  or leave empty',
  });
  // Undefined means the user pressed Escape – treat same as empty
  const resolvedKey = apiKey ?? '';

  try {
    await addProvider(id, displayName, baseUrl, resolvedKey);
    const action = await vscode.window.showInformationMessage(
      `✅ Provider "${displayName}" added. Would you like to add a model now?`,
      'Add Model', 'Later'
    );
    if (action === 'Add Model') {
      await cmdAddModel(id);
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to add provider: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Remove a provider after confirmation */
async function cmdRemoveProvider(): Promise<void> {
  const providers = getProviders();
  if (providers.length === 0) {
    vscode.window.showInformationMessage('No providers configured. Add one first!');
    return;
  }

  const items = providers.map(p => ({
    label: p.displayName,
    description: `${p.models.length} model(s) · ${p.baseUrl}`,
    providerId: p.id,
  }));

  const chosen = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a provider to remove',
  });
  if (!chosen) { return; }

  const confirm = await vscode.window.showWarningMessage(
    `Remove provider "${chosen.label}" and all its ${
      providers.find(p => p.id === chosen.providerId)?.models.length ?? 0
    } model(s)?`,
    { modal: true },
    'Remove'
  );
  if (confirm !== 'Remove') { return; }

  const removed = await removeProvider(chosen.providerId);
  if (removed) {
    vscode.window.showInformationMessage(`Provider "${chosen.label}" removed.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Wizard: add a model to an existing provider.
 *  @param preselectedProviderId – If provided, skip the provider picker.
 */
async function cmdAddModel(preselectedProviderId?: string): Promise<void> {
  // ── Choose provider ───────────────────────────────────────────────────────
  let providerId = preselectedProviderId;

  if (!providerId) {
    const providers = getProviders();
    if (providers.length === 0) {
      vscode.window.showInformationMessage('Add a provider first using "Add Provider".');
      return;
    }

    const chosen = await vscode.window.showQuickPick(
      providers.map(p => ({
        label: p.displayName,
        description: p.baseUrl,
        id: p.id,
      })),
      { placeHolder: 'Select a provider to add a model to' }
    );
    if (!chosen) { return; }
    providerId = chosen.id;
  }

  const providerLabel = getProviders().find(p => p.id === providerId)?.displayName ?? providerId;

  // ── Step 1: Model ID ──────────────────────────────────────────────────────
  const modelId = await vscode.window.showInputBox({
    title: `Add Model to "${providerLabel}" (1/3) – Model ID`,
    prompt: 'The model identifier as the API expects it',
    placeHolder: 'e.g. nvidia/llama-3.1-nemotron-ultra-253b-v1',
    validateInput: v => v.trim() ? undefined : 'Model ID cannot be empty',
  });
  if (!modelId) { return; }

  // ── Step 2: Display Name ──────────────────────────────────────────────────
  const modelName = await vscode.window.showInputBox({
    title: `Add Model to "${providerLabel}" (2/3) – Display Name`,
    prompt: 'Human-readable name shown in the Copilot model picker',
    placeHolder: 'e.g. Llama 3.1 Nemotron Ultra 253B',
    validateInput: v => v.trim() ? undefined : 'Display name cannot be empty',
  });
  if (!modelName) { return; }

  // ── Step 3: Context size ──────────────────────────────────────────────────
  const ctxStr = await vscode.window.showInputBox({
    title: `Add Model to "${providerLabel}" (3/3) – Max Input Tokens`,
    prompt: 'Maximum input context window in tokens',
    value: '128000',
    validateInput: v => isNaN(parseInt(v)) ? 'Must be a number' : undefined,
  });
  if (!ctxStr) { return; }

  // Tools support quick-pick
  const toolChoice = await vscode.window.showQuickPick(
    [
      { label: '$(check) Yes – model supports tool/function calling', value: true },
      { label: '$(close) No – text only', value: false },
    ],
    { placeHolder: 'Does this model support tool calling?' }
  );
  if (!toolChoice) { return; }

  const model: ModelConfig = {
    id: modelId.trim(),
    name: modelName.trim(),
    maxInputTokens: parseInt(ctxStr),
    maxOutputTokens: 4096,   // Conservative default; user can edit settings.json if needed
    supportsToolCalling: toolChoice.value,
  };

  try {
    await addModel(providerId, model);
    vscode.window.showInformationMessage(
      `✅ Model "${modelName}" added to "${providerLabel}". ` +
      `Reload the window or re-open Copilot Chat to see it in the model picker.`
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to add model: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Remove a model from a provider */
async function cmdRemoveModel(): Promise<void> {
  const providers = getProviders();
  if (providers.length === 0) {
    vscode.window.showInformationMessage('No providers configured.');
    return;
  }

  // Pick provider
  const providerChoice = await vscode.window.showQuickPick(
    providers.map(p => ({
      label: p.displayName,
      description: `${p.models.length} model(s)`,
      id: p.id,
    })),
    { placeHolder: 'Select a provider' }
  );
  if (!providerChoice) { return; }

  const provider = providers.find(p => p.id === providerChoice.id)!;
  if (provider.models.length === 0) {
    vscode.window.showInformationMessage(`Provider "${provider.displayName}" has no models.`);
    return;
  }

  // Pick model
  const modelChoice = await vscode.window.showQuickPick(
    provider.models.map(m => ({
      label: m.name,
      description: m.id,
      id: m.id,
    })),
    { placeHolder: 'Select a model to remove' }
  );
  if (!modelChoice) { return; }

  const confirm = await vscode.window.showWarningMessage(
    `Remove model "${modelChoice.label}" from "${provider.displayName}"?`,
    { modal: true },
    'Remove'
  );
  if (confirm !== 'Remove') { return; }

  const removed = await removeModel(provider.id, modelChoice.id);
  if (removed) {
    vscode.window.showInformationMessage(`Model "${modelChoice.label}" removed.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Display a readable summary of all configured providers */
async function cmdListProviders(): Promise<void> {
  const providers = getProviders();

  if (providers.length === 0) {
    vscode.window.showInformationMessage(
      'No providers configured yet. Use "Add Provider" to get started.'
    );
    return;
  }

  // Build quick-pick items – one group per provider with its models as children
  type Item = vscode.QuickPickItem & { action?: string; providerId?: string };
  const items: Item[] = [];

  for (const p of providers) {
    // Provider header (separator style)
    items.push({
      label: `$(server) ${p.displayName}`,
      description: p.baseUrl,
      kind: vscode.QuickPickItemKind.Separator,
    });

    if (p.models.length === 0) {
      items.push({ label: '  $(warning) No models configured', description: 'Add a model to use this provider' });
    } else {
      for (const m of p.models) {
        items.push({
          label: `  $(circuit-board) ${m.name}`,
          description: m.id,
          detail: `  Input: ${m.maxInputTokens.toLocaleString()} tokens · Tools: ${m.supportsToolCalling ? 'yes' : 'no'}`,
        });
      }
    }
  }

  await vscode.window.showQuickPick(items, {
    placeHolder: `${providers.length} provider(s) configured`,
    matchOnDescription: true,
    matchOnDetail: true,
  });
}
