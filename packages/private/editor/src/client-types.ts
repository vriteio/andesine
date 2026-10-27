import type { Accessor, JSX } from "solid-js";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Editor as EditorInstance, JSONContent } from "@tiptap/core";
import type { IconPickerIcons, IconPickerSet, LinkInputEntry } from "@andesine/components";

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
/** A direct child block of an element, as element views see it. */
interface ElementChild {
  /** The node ID. */
  key: string;
  /** The node type, e.g. `element` or `codeBlock`. */
  type: string;
  element?: string;
  props?: Record<string, unknown>;
  language?: string;
  /** A code block's title, e.g. its tab label in a code group. */
  title?: string;
  /** Whether the text cursor or a text selection is in it. */
  hasSelection: boolean;
  /** Whether a block selection selects it, e.g. after a right click on it, not the element around it. */
  blockSelected: boolean;
  /** Whether the drag handle and block menu trigger are for it, e.g. while it's hovered. */
  handleTarget: boolean;
  /** Whether a drop now goes to it, from a droppable `BlockArea`, e.g. taking its place. */
  dropTarget: boolean;
  /** Whether the editor drags it. */
  dragged: boolean;
}
interface ElementPlace {
  /** The element's node ID. */
  key: string | null;
  /** The position among the siblings with the same name, e.g. 0 for the first `Step`. */
  index: number;
  /** The node ID of the nearest enclosing element, e.g. the `Tabs` of a `Tab`. */
  parentID: string | null;
  /** The element's direct child blocks, for views that draw them, e.g. a tab bar. */
  children: ElementChild[];
  /** Whether a block selection selects the element itself, e.g. after a right click on its UI. */
  blockSelected: boolean;
  /** Whether a block selection holds the element, also with one around it, e.g. a folder's. */
  inBlockSelection: boolean;
  /** Whether a drop now goes to the element, from a droppable `BlockArea`. */
  dropTarget: boolean;
  /** Whether the editor drags the element. */
  dragged: boolean;
}
interface ChildPresentation {
  /** Child blocks the view hides, e.g. the tabs that aren't selected. */
  hidden: string[];
  /** Child blocks without their own frame and background, e.g. code blocks in a code group. */
  plain: string[];
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
  /** Where the element is in the document, and its selection and drag states. */
  place: Accessor<ElementPlace>;
  /** Presents child blocks by node ID, e.g. hidden or plain; the editor draws them. */
  setChildPresentation(presentation: ChildPresentation): void;
  /** Switches back to the standard tag view, e.g. after a view error. */
  fallback(): void;
  /** Updates the element's props with a normal transaction; false if they cannot be saved. */
  setProps(props: Record<string, unknown>): boolean;
  /** Adds a block at the end of the content, with the cursor in its text; false if not allowed. */
  append(block: JSONContent): boolean;
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
  props?: Record<string, unknown>;
  /** Offered only inside this root element, e.g. `Tab` in `Tabs`. */
  parent?: string;
  /** The slash menu group, e.g. `docs`; without it, the "Elements" group. */
  category?: string;
}
/** A prop of an element's props schema: the field kinds of the props menu. */
interface ElementPropField {
  name: string;
  type: "string" | "number" | "integer" | "boolean";
  title?: string;
  description?: string;
  enum?: string[];
  control?: "input" | "textarea" | "icon" | "link" | "select" | "toggle";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  default?: string | number | boolean;
}
/** The direct child blocks that an element's content accepts. */
interface ElementAccepts {
  /** Child elements by name, e.g. `Tab`. */
  elements?: string[];
  /** Standard blocks by node type, e.g. `codeBlock`. */
  blocks?: string[];
}
/** An element's content rules: the direct child blocks that fit. */
interface ElementContentRules {
  /** Without it, any blocks. */
  accepts?: ElementAccepts;
  /** Blocks that don't fit, even if `accepts` has them, e.g. no nested `Accordion`. */
  rejects?: ElementAccepts;
}
/** What the editor knows about an element from its view, e.g. its content rules. */
interface ElementViewDescription extends ElementContentRules {
  /** False for elements without content, e.g. `<File />`. */
  content: boolean;
  /** Props for a new element, e.g. when a clean-up wraps blocks into one. */
  props?: Record<string, unknown>;
}
/** Extension views for elements; the standard tag view renders when none applies. */
interface ElementViews {
  /** Reactive. `ancestors` are the names of the enclosing elements, nearest first. */
  resolve(name: string, ancestors: string[]): ElementViewRenderer | null;
  /** The props schema of the view that `resolve` returns, if it has one. */
  schema(name: string, ancestors: string[]): ElementPropsSchema | null;
  /** The content rules and defaults of the view that `resolve` returns. */
  describe(name: string, ancestors: string[]): ElementViewDescription | null;
  /**
   * Where an element may be, by the names of the elements it may be directly inside, e.g.
   * `Steps` for a `Step` that only its template draws; null for anywhere.
   */
  parents(name: string): string[] | null;
  /** Reactive. The element views that apply in the workspace, with named descendants. */
  list(): ElementViewOption[];
}
/** Entries that links can point to, as `entry:<entryID>`, e.g. the workspace's content tree. */
interface EditorLinks {
  entries(): LinkInputEntry[];
  openEntry(entryID: string, newTab: boolean): void;
  /** The app URL of an entry, e.g. to copy its link. */
  getEntryURL(entryID: string): string;
  /** The `entry:` link for a URL of the app that opens an entry, e.g. a pasted entry URL. */
  toEntryLink(url: string): string | null;
}
/** Icons of element props with the `icon` control, e.g. a card's. */
interface EditorIcons {
  /** The sets to choose from, in their order. */
  sets: IconPickerSet[];
  loadSet(prefix: string): Promise<IconPickerIcons | null>;
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
  links?: EditorLinks;
  icons?: EditorIcons;
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

/**
 * The props that the editor's props menu edits for an element with a view, in order; they're
 * optional, and clearing one with a `default` restores the default.
 */
type ElementPropsSchema = ElementPropField[];
type BlockMenuPlacement = `${"top" | "bottom" | "left" | "right"}${"" | "-start" | "-end"}`;
type EditorMode = "entry" | "schema";
type EditorProvider = HocuspocusProvider;
type EditorCleanup = (() => void) | void;
type EditorProviderSetup = (
  provider: EditorProvider
) => EditorProviderSetupResult | Promise<EditorProviderSetupResult>;

export type {
  EditorIcons,
  EditorImageDuplicate,
  EditorImageDuplicateHandler,
  EditorImageAsset,
  EditorImages,
  EditorLinks,
  EditorCleanup,
  EditorDiff,
  EditorDiffChange,
  EditorInstance,
  EditorMode,
  EditorProps,
  EditorProvider,
  EditorProviderSetup,
  EditorProviderSetupResult,
  ElementPlace,
  ElementViewMount,
  ElementViewOption,
  ElementViewRenderer,
  ElementViews,
  ElementPropField,
  ElementPropsSchema,
  BlockAction,
  BlockActionOrigin,
  BlockActions,
  BlockMenuPlacement,
  BlockActionTarget,
  MergedVersionDiff,
  VersionComparison,
  ElementChild,
  ChildPresentation,
  ElementAccepts,
  ElementContentRules,
  ElementViewDescription
};
