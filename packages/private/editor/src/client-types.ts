import type { Accessor, JSX } from "solid-js";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Editor as EditorInstance, JSONContent } from "@tiptap/core";

interface EditorProviderSetupResult {
  cleanup?(): void;
  renderImmediately: boolean;
}
interface EditorDiffChange {
  from: number;
  inline: boolean;
  to: number;
  type: "added" | "modified" | "removed";
}
interface EditorDiff {
  changes: EditorDiffChange[];
}
interface MergedVersionDiff extends EditorDiff {
  content: JSONContent;
}
interface VersionComparison {
  current: MergedVersionDiff;
  inline: MergedVersionDiff;
  previous: MergedVersionDiff;
}
interface EditorImageAsset {
  assetID: string;
  width: number;
  height: number;
}
interface EditorImageDuplicate extends EditorImageAsset {
  filename: string;
  entryName: string;
  thumbnailURL: string;
}
interface EditorImageDuplicateHandler {
  (image: EditorImageDuplicate): Promise<"reuse" | "upload" | "cancel">;
}
interface EditorImagePickerProps {
  onSelect(image: EditorImageAsset): void;
  onClose(): void;
}
interface ElementViewMount {
  /** The view renders into it; it is not editable. */
  container: HTMLElement;
  /** The element's editable content; move it into the view's slot, never recreate it. */
  contentDOM: HTMLElement;
  /** Inside the element; holds the content while no slot shows it. */
  parking: HTMLElement;
  name: Accessor<string>;
  props: Accessor<Record<string, unknown>>;
  /** Switches back to the standard tag view, e.g. after a view error. */
  fallback(): void;
  /** Updates the element's props with a normal transaction; false if they cannot be saved. */
  setProps(props: Record<string, unknown>): boolean;
}
interface BlockActionTarget {
  /** The selected sibling blocks as editor JSON. */
  blocks: JSONContent[];
  /** One transaction; false when the blocks changed or the content is not allowed there. */
  replace(content: JSONContent[]): boolean;
  insertAfter(content: JSONContent[]): boolean;
  /** The blocks' current bounds on the screen, e.g. to anchor a popover; null once released. */
  getRect(): DOMRect | null;
  /** Stops tracking the blocks; later edits fail. */
  release(): void;
}
/** Where the block menu was when an action was chosen, for a menu that opens in its place. */
interface BlockActionOrigin {
  /** The editor's menu layer, which scrolls with the content. */
  container: HTMLElement;
  /** What the block menu was anchored to (its trigger, or a point), in viewport coordinates. */
  anchor: { x: number; y: number; width: number; height: number };
  /** The block menu's placement against its anchor, e.g. `bottom-end`. */
  placement: BlockMenuPlacement;
  /** The block menu's width, so a menu in its place is at least as wide. */
  width: number;
  zIndex: number;
  /** Keeps the block menu's trigger shown, as while the block menu is open; returns its release. */
  holdTrigger(): () => void;
}
interface BlockAction {
  id: string;
  label: string;
  /** An icon class, e.g. `i-lucide:languages`, or an icon element, e.g. a scoped extension icon. */
  icon?: string | (() => JSX.Element);
  /**
   * While the returned promise is pending, the menu stays open and shows a spinner. `origin` is
   * null on narrow screens, where the block menu is a bottom sheet.
   */
  run(target: BlockActionTarget, origin: BlockActionOrigin | null): void | Promise<void>;
}
interface BlockActions {
  get(blockTypes: string[]): BlockAction[];
}
interface ElementViewRenderer {
  /** Renders the view and returns its cleanup, after which the content must be in `parking`. */
  mount(mount: ElementViewMount): () => void;
}
/** An element with a view, which the slash menu inserts. */
interface ElementViewOption {
  element: string;
  label: string;
  description?: string;
  /** An icon class, or an icon element, e.g. a scoped extension icon. */
  icon?: string | (() => JSX.Element);
  /** Inserts the element without content, e.g. `<Badge />`. */
  selfClosing: boolean;
}
/** Extension views for elements; the standard tag view renders when none applies. */
interface ElementViews {
  /** Reactive. `ancestors` are the names of the enclosing elements, nearest first. */
  resolve(name: string, ancestors: string[]): ElementViewRenderer | null;
  /** Reactive. The root element views that apply in the workspace. */
  list(): ElementViewOption[];
}
interface EditorImages {
  renderPicker?(props: EditorImagePickerProps): JSX.Element;
  enabled(): boolean;
  load(assetID: string, signal: AbortSignal, onCached?: (file: Blob) => void): Promise<Blob>;
  upload(
    file: File,
    signal: AbortSignal,
    onDuplicate?: EditorImageDuplicateHandler
  ): Promise<EditorImageAsset | null>;
  uploadURL(
    url: string,
    signal: AbortSignal,
    onDuplicate?: EditorImageDuplicateHandler
  ): Promise<EditorImageAsset | null>;
  attach(assetIDs: string[], signal: AbortSignal): Promise<void>;
}
interface EditorProps {
  images?: EditorImages;
  class?: string;
  content?: JSONContent;
  url?: string;
  doc?: string;
  editable?: boolean;
  mode?: EditorMode;
  elementViews?: ElementViews;
  blockActions?: BlockActions;
  staticTitle?: string;
  diff?: EditorDiff;
  providerAttempt?: number;
  notify?(type: "success" | "error", text: string): void;
  collaborationUser?: { name: string; color: string };
  beforeProviderAttach?: EditorProviderSetup;
  onProvider?(provider: EditorProvider): EditorCleanup;
  onProviderSetupError?(error: unknown, provider: EditorProvider): void;
  onEditor?(editor: EditorInstance): EditorCleanup;
  onScrollContainer?(container: HTMLElement | null): void;
  validateTitle?(title: string): string | undefined;
  initialTitle?: string;
  onTitleChange?(title: string): void;
}

type BlockMenuPlacement = `${"top" | "bottom" | "left" | "right"}${"" | "-start" | "-end"}`;
type EditorMode = "entry" | "schema";
type EditorProvider = HocuspocusProvider;
type EditorCleanup = (() => void) | void;
type EditorProviderSetup = (
  provider: EditorProvider
) => EditorProviderSetupResult | Promise<EditorProviderSetupResult>;

export type {
  EditorImageDuplicate,
  EditorImageDuplicateHandler,
  EditorImageAsset,
  EditorImages,
  EditorCleanup,
  EditorDiff,
  EditorDiffChange,
  EditorInstance,
  EditorMode,
  EditorProps,
  EditorProvider,
  EditorProviderSetup,
  EditorProviderSetupResult,
  ElementViewMount,
  ElementViewOption,
  ElementViewRenderer,
  ElementViews,
  BlockAction,
  BlockActionOrigin,
  BlockActions,
  BlockMenuPlacement,
  BlockActionTarget,
  MergedVersionDiff,
  VersionComparison
};
