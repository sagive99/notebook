/** Dependency direction for the workspace (see docs/adr/0006-workspace-layering.md). */
module.exports = {
  forbidden: [
    {
      name: 'core-stays-pure',
      comment: '@notebook/core is framework- and browser-free domain code.',
      severity: 'error',
      from: { path: '^packages/notebook-core/src' },
      to: { path: '^(apps/|node_modules/(preact|vite)/)' },
    },
    {
      name: 'ui-uses-ports-not-adapters',
      comment: 'UI depends on state and ports; only the composition root constructs adapters.',
      severity: 'error',
      from: { path: '^apps/web/src/ui' },
      to: { path: '^apps/web/src/adapters' },
    },
    {
      name: 'adapters-do-not-know-ui-or-state',
      severity: 'error',
      from: { path: '^apps/web/src/adapters' },
      to: { path: '^apps/web/src/(ui|state)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(\\.unit\\.test\\.tsx?$|test-fakes\\.ts$|test-support\\.ts$)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/web/tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'], extensions: ['.ts', '.tsx', '.js'] },
  },
};
