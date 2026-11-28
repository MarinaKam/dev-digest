import type { FeatureModelChoice, Provider } from '@devdigest/shared';

/** Source files sent to the model per run, by sampling strategy (spec 004). */
export const SAMPLE_FILE_COUNT = { top: 12, spread: 24 } as const;

/**
 * Config files read from the clone root when present. They show the rules a
 * team wrote down for its tools (lint, format, compiler) next to the code.
 */
export const CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'biome.json',
  '.editorconfig',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  'prettier.config.js',
] as const;

/** Each file sent to the model is cut to this many lines and characters. */
export const MAX_FILE_LINES = 200;
export const MAX_FILE_CHARS = 8_000;

/** Secret that holds each provider's API key. */
export const PROVIDER_KEY: Record<Provider, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

/**
 * Cheap model of each provider, in the order they are tried when the
 * registry default's provider has no key.
 */
export const CHEAP_MODELS: readonly FeatureModelChoice[] = [
  { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
  { provider: 'openai', model: 'gpt-4.1-mini' },
  { provider: 'anthropic', model: 'claude-haiku-5-5' },
];

/** Low temperature: the answer must quote files, not invent. */
export const EXTRACTION_TEMPERATURE = 0.1;
export const EXTRACTION_MAX_TOKENS = 6_000;
export const EXTRACTION_TIMEOUT_MS = 120_000;
