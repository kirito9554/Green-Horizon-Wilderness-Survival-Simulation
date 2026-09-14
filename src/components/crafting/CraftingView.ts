// Compatibility entrypoint.
// Extensionless imports resolve this .ts file before the legacy .tsx module.
// Keeping the old module in place allows easy rollback while the deep simulation
// workspace is validated in playtests.
export { CraftingView } from './CraftingViewImpl';
