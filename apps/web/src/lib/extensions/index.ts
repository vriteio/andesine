export { createExtensionSandbox } from "./sandbox";
export type { ExtensionSandbox, ExtensionSandboxFailure, ExtensionSandboxOptions } from "./sandbox";
export { createExtensionHost } from "./host";
export type { ExtensionHost, ExtensionHostOptions } from "./host";
export { createExtensionTree, ExtensionTreeError } from "./view-tree";
export type { ExtensionTree, ExtensionTreeNode, ExtensionTreeState } from "./view-tree";
export { loadExtensionArtifact } from "./artifact";
export { isDeclaredURL } from "./urls";
export {
  runningExtensions,
  extensionsLoading,
  setExtensionsLoading,
  startExtension,
  stopExtension,
  setExtensionHostActions,
  getExtensionHostActions,
  getExtensionPanels,
  getExtensionPages,
  findExtensionPage,
  isExtensionChange,
  notifyExtensionStorage
} from "./registry";
export type {
  RunningExtension,
  RunningExtensionOptions,
  RunningExtensionPanel,
  RunningExtensionPage,
  RunningExtensionStatus
} from "./registry";
export { createRootFinder, getTemplateParents, matchElementView } from "./element-matching";
export type {
  ElementRoot,
  ElementViewMatch,
  ElementViewSource,
  RootFinder
} from "./element-matching";
export type { ExtensionHostActions, ExtensionViewTarget } from "./requests";
export {
  setExtensionMember,
  getExtensionMember,
  getEffectivePermissions,
  notifyExtensionUpdate
} from "./authority";
export type { ExtensionMember } from "./authority";
export { describeExtensionPermission, getURLHost, getGrantChanges } from "./grant";
export type { GrantChanges } from "./grant";
export { loadExtensionIconStyles } from "./icons";
export { getExtensionPagePath } from "./pages";
export {
  getAvailablePagePath,
  isPageAvailable,
  isPageAvailabilityKnown,
  refreshPageAvailability,
  resolvePageContext,
  setPageContextResolver
} from "./page-availability";
export type { PageContextIDs } from "./page-availability";
export type { ExtensionPageContext } from "./pages";
