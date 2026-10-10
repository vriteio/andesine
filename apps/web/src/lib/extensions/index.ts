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
  startExtension,
  stopExtension,
  setExtensionHostActions,
  getExtensionHostActions,
  getExtensionPanels
} from "./registry";
export type {
  RunningExtension,
  RunningExtensionOptions,
  RunningExtensionPanel,
  RunningExtensionStatus
} from "./registry";
export { createRootFinder, matchElementView } from "./element-matching";
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
