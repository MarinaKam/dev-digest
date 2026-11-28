/**
 * Import rules for the server's dependency direction (inner rings never import
 * outer rings). The ring map is in AGENTS.md, "Dependency direction".
 *
 * Run: `pnpm lint:arch`. Violations that existed when the rules were added are
 * listed in `.dependency-cruiser-known-violations.json` and are not reported;
 * that file should only shrink.
 */

const PERSISTENCE = '(^|/)repository(\\.ts$|/)';
const HTTP_EDGE = '^src/(app|server)\\.ts$|^src/modules/(index\\.ts$|_shared/context\\.ts$|[^/]+/routes\\.ts$)';
const VENDOR_SDK =
  'node_modules/(\\.pnpm/)?(octokit|@octokit|openai|@anthropic-ai|simple-git|@ast-grep|@vscode\\+ripgrep|@vscode/ripgrep|js-tiktoken|dependency-cruiser)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'orm-only-in-persistence',
      comment:
        'Inside a module and in platform code, Drizzle and the table schema are imported ' +
        'only by a repository. Move the query into the repository and return plain ' +
        'values. The container is the composition root and is exempt.',
      severity: 'error',
      from: { path: '^src/(modules|platform)/', pathNot: `${PERSISTENCE}|^src/platform/container\\.ts$` },
      to: { path: 'node_modules/(\\.pnpm/)?drizzle-orm|^src/db/' },
    },
    {
      name: 'http-framework-only-at-the-edge',
      comment:
        'Fastify types stay in routes.ts and the app bootstrap. Pass plain values ' +
        '(ids, parsed bodies) to services.',
      severity: 'error',
      from: { path: '^src/', pathNot: HTTP_EDGE },
      to: { path: 'node_modules/(\\.pnpm/)?(fastify|@fastify)' },
    },
    {
      name: 'modules-do-not-import-adapters',
      comment:
        'A module depends on a port, not on an adapter file. Get the implementation ' +
        'from the container; declare the port where the inner code can import it.',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'vendor-sdk-only-in-adapters',
      comment: 'A third-party SDK is imported only inside src/adapters.',
      severity: 'error',
      from: { path: '^src/(modules|platform)/' },
      to: { path: VENDOR_SDK },
    },
    {
      name: 'adapters-do-not-import-modules',
      comment:
        'An adapter does not know the feature that uses it. The one file it may import ' +
        'from a module is ports.ts, to implement the port declared there.',
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: { path: '^src/modules/', pathNot: '^src/modules/[^/]+/ports\\.ts$' },
    },
    {
      name: 'no-import-from-a-sibling-module',
      comment:
        'A module does not reach into another module folder. Share through the ' +
        'container or through src/modules/_shared.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/[^/]+/', pathNot: '^src/modules/($1|_shared)/' },
    },
    {
      name: 'review-engine-stays-pure',
      comment:
        'reviewer-core is the innermost ring: no server code, no HTTP framework, no ORM.',
      severity: 'error',
      from: { path: 'reviewer-core/src/' },
      to: { path: '^src/(modules|platform|adapters|db)/|node_modules/(\\.pnpm/)?(fastify|@fastify|drizzle-orm|postgres)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/vendor/shared/|\\.d\\.ts$' },
    // `import type` crosses a ring just like a value import does.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js'],
    },
  },
};
