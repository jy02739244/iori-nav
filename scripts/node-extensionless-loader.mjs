import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function resolveExistingFile(specifier, parentURL) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null;
  if (!parentURL || !parentURL.startsWith('file:')) return null;

  const base = new URL(specifier, parentURL);
  const candidates = [
    new URL(`${base.href}.js`),
    new URL(`${base.href}/index.js`),
  ];

  for (const candidate of candidates) {
    if (existsSync(fileURLToPath(candidate))) {
      return candidate.href;
    }
  }

  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;

    const resolvedURL = resolveExistingFile(specifier, context.parentURL);
    if (!resolvedURL) throw error;

    return { url: resolvedURL, shortCircuit: true };
  }
}
