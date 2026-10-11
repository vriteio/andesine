import {
  readDocumentContent,
  updateDocumentContent,
  type ContentConnection,
  type ContentSnapshot,
  type ContentState
} from "#backend/collaboration";

interface PreparedItem {
  content: ContentState;
  previous: ContentSnapshot;
  replacesUnsavedContent: boolean;
}
interface AppliedItem {
  index: number;
  /** Hash of the live content after the change. */
  hash: string;
}
interface StaleItem {
  index: number;
  /** Hash of the live content that changed since it was read. */
  hash: string;
  /** Items applied before it that kept the change, because they were edited meanwhile. */
  unrestored: AppliedItem[];
}

/** Live documents don't roll back with a transaction, so applied items are kept to restore. */
class LiveContentChanges {
  applied: AppliedItem[] = [];

  private prepared: PreparedItem[] = [];

  constructor(
    private readonly connections: ContentConnection[],
    private readonly webhookOperationID: string
  ) {}

  /** Applies items back to back, so live edits rarely land between them; restores on a live edit. */
  async apply(prepared: PreparedItem[]): Promise<StaleItem | null> {
    this.prepared = prepared;

    for (const [index, { content, previous }] of prepared.entries()) {
      const result = await updateDocumentContent(this.connections[index], content.document, {
        expectedHash: previous.hash,
        webhookOperationID: this.webhookOperationID
      });

      if (!result.applied) {
        return { index, hash: result.snapshot.hash, unrestored: await this.restore() };
      }

      this.applied.push({ index, hash: result.snapshot.hash });
    }

    return null;
  }

  /** @returns The items that still have the change; each item is tried. */
  async restore(): Promise<AppliedItem[]> {
    const applied = this.applied.splice(0);
    const unrestored: AppliedItem[] = [];

    for (const item of applied) {
      const restored = await this.restoreItem(item);

      if (!restored) unrestored.push(item);
    }

    return unrestored;
  }

  /** @returns Whether the item has its previous content, also when restoring threw. */
  private async restoreItem({ index, hash }: AppliedItem): Promise<boolean> {
    const connection = this.connections[index];
    const { previous } = this.prepared[index];

    try {
      const result = await updateDocumentContent(connection, previous.document, {
        expectedHash: hash,
        webhookOperationID: this.webhookOperationID,
        restore: true
      });

      return result.applied;
    } catch (error) {
      console.error(error);

      // The error can come before or after the change; the current content tells which.
      const current = await readDocumentContent(connection).catch(() => null);

      return current?.hash === previous.hash;
    }
  }
}

export { LiveContentChanges };
export type { PreparedItem, StaleItem };
