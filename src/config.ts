/**
 * config.ts
 *
 * Helpers for reading and writing provider configurations from VS Code settings.
 * All provider data lives under the "openai-compat-provider.providers" array in settings.json.
 */

import * as vscode from 'vscode';
import { ProviderConfig, ModelConfig } from './types';

/** The VS Code configuration section key */
const CONFIG_SECTION = 'openai-compat-provider';
const PROVIDERS_KEY = 'providers';

/**
 * Read the full list of configured providers from VS Code settings.
 * Returns an empty array if nothing is set.
 */
export function getProviders(): ProviderConfig[] {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const rawProviders = config.get<ProviderConfig[]>(PROVIDERS_KEY, []);

  // Ensure defaults for optional fields so the rest of the code never has to guard for undefined
  return rawProviders.map(p => ({
    id: p.id,
    displayName: p.displayName,
    baseUrl: p.baseUrl.replace(/\/$/, ''), // trim trailing slash
    apiKey: p.apiKey ?? '',
    models: (p.models ?? []).map(m => ({
      id: m.id,
      name: m.name,
      maxInputTokens: m.maxInputTokens ?? 128000,
      maxOutputTokens: m.maxOutputTokens ?? 4096,
      supportsToolCalling: m.supportsToolCalling ?? true,
    })),
  }));
}

/**
 * Persist the full providers list back to VS Code settings (global scope).
 */
export async function saveProviders(providers: ProviderConfig[]): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update(PROVIDERS_KEY, providers, vscode.ConfigurationTarget.Global);
}

/**
 * Add a brand-new provider entry. Throws if a provider with the same ID already exists.
 */
export async function addProvider(
  id: string,
  displayName: string,
  baseUrl: string,
  apiKey: string
): Promise<ProviderConfig> {
  const providers = getProviders();

  if (providers.some(p => p.id === id)) {
    throw new Error(`A provider with id "${id}" already exists.`);
  }

  const newProvider: ProviderConfig = { id, displayName, baseUrl, apiKey, models: [] };
  providers.push(newProvider);
  await saveProviders(providers);
  return newProvider;
}

/**
 * Remove a provider by its ID. Returns true if removed, false if not found.
 */
export async function removeProvider(id: string): Promise<boolean> {
  const providers = getProviders();
  const next = providers.filter(p => p.id !== id);
  if (next.length === providers.length) { return false; }
  await saveProviders(next);
  return true;
}

/**
 * Add a model to an existing provider. Throws if provider not found or model ID duplicated.
 */
export async function addModel(providerId: string, model: ModelConfig): Promise<void> {
  const providers = getProviders();
  const provider = providers.find(p => p.id === providerId);

  if (!provider) {
    throw new Error(`Provider "${providerId}" not found.`);
  }
  if (provider.models.some(m => m.id === model.id)) {
    throw new Error(`Model "${model.id}" already exists in provider "${providerId}".`);
  }

  provider.models.push(model);
  await saveProviders(providers);
}

/**
 * Remove a model from a provider. Returns true if removed, false if not found.
 */
export async function removeModel(providerId: string, modelId: string): Promise<boolean> {
  const providers = getProviders();
  const provider = providers.find(p => p.id === providerId);
  if (!provider) { return false; }

  const nextModels = provider.models.filter(m => m.id !== modelId);
  if (nextModels.length === provider.models.length) { return false; }

  provider.models = nextModels;
  await saveProviders(providers);
  return true;
}
