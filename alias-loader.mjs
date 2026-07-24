import { URL } from 'node:url';

const aliasRoots = [
  ['@api', new URL('./packages/api-automation/', import.meta.url)],
  ['@common', new URL('./packages/common-module/', import.meta.url)],
  ['@fixtures', new URL('./packages/common-module/fixtures/', import.meta.url)],
  ['@web', new URL('./packages/web-automation/', import.meta.url)],
  ['@mobile', new URL('./packages/mobile-automation/', import.meta.url)],
];

export async function resolve(specifier, context, nextResolve) {
  // Check if specifier is an alias
  for (const [alias, root] of aliasRoots) {
    if (specifier === alias || specifier.startsWith(`${alias}/`)) {
      const remainder = specifier === alias ? 'index.js' : specifier.slice(alias.length + 1);
      const target = new URL(remainder, root);

      return nextResolve(target.href, context);
    }
  }

  // For non-aliased imports, pass through to the default resolver
  return nextResolve(specifier, context);
}
