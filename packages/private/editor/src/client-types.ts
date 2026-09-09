import type { JSX } from "solid-js";
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
  onTitleChange?(title: string): void;
}

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
  MergedVersionDiff,
  VersionComparison
};
