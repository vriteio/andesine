import { getLinkedEntryID } from "@andesine/components";
import { combineTransactionSteps, Extension, getChangedRanges } from "@tiptap/core";
import { type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorLinks } from "#editor/client-types";
import {
  BOUNDARY_CURSOR_ACTIVE_CLASS,
  createBoundaryCursor,
  createClickedSide,
  isRemoteChange
} from "./boundary-cursor";

interface LinksOptions {
  links(): EditorLinks | undefined;
}
interface LinksState {
  decorations: DecorationSet;
  /** The link start that the caret is "in", after the icon, so typed text joins the link. */
  linkStart: number | null;
}
/** `true` refreshes the decorations, e.g. for new entries; `linkStart` sets the caret's side. */
type LinksMeta = true | { linkStart: number | null };

const linksPluginKey = new PluginKey<LinksState>("links");

/**
 * An icon before a link, rendered inside it (`side: 1`): a file for an entry link, a globe for
 * other links.
 */
const createLinkIcon = (pos: number, isEntryLink: boolean, unavailable: boolean) => {
  return Decoration.widget(
    pos,
    () => {
      const icon = document.createElement("span");

      icon.className = "link-icon";
      icon.contentEditable = "false";
      icon.setAttribute("aria-hidden", "true");
      icon.setAttribute("data-kind", isEntryLink ? "entry" : "url");

      if (unavailable) icon.setAttribute("data-unavailable", "");

      return icon;
    },
    { side: 1, ignoreSelection: true, key: `link-icon-${isEntryLink}-${unavailable}` }
  );
};
/** The marks of a link that starts at a position, e.g. to type at the link's start. */
const getLinkStartMarks = (doc: ProseMirrorNode, pos: number) => {
  const $pos = doc.resolve(pos);
  const link = $pos.nodeAfter?.marks.find(({ type }) => type.name === "link");

  if (!link || link.isInSet($pos.nodeBefore?.marks ?? [])) return null;

  return $pos.nodeAfter!.marks;
};
/** Whether the caret is at a link's start, before or after its icon. */
const isAtLinkStart = (state: EditorState) => {
  const { selection } = state;

  return selection.empty && Boolean(getLinkStartMarks(state.doc, selection.from));
};
/**
 * Links get an icon; entry links also get the entry's title as a tooltip, or show that the entry
 * is gone.
 */
const getLinkDecorations = (doc: ProseMirrorNode, links: EditorLinks | undefined) => {
  const entries = new Map(links?.entries().map((entry) => [entry.id, entry]));
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    const href = node.isText && node.marks.find(({ type }) => type.name === "link")?.attrs.href;
    const entryID = typeof href === "string" ? getLinkedEntryID(href) : null;
    const entry = entryID ? entries.get(entryID) : undefined;
    // Without a tree yet, e.g. while it loads, every entry would look gone.
    const isUnavailable = Boolean(entryID) && entries.size > 0 && !entry;

    if (typeof href !== "string") return;

    if (getLinkStartMarks(doc, pos)) {
      decorations.push(createLinkIcon(pos, Boolean(entryID), isUnavailable));
    }

    if (!entryID) return;

    const attrs = isUnavailable
      ? { "title": "The entry was deleted or can't be read", "data-unavailable": "" }
      : { title: entry?.title ?? "" };

    decorations.push(Decoration.inline(pos, pos + node.nodeSize, attrs));
  });

  return DecorationSet.create(doc, decorations);
};
/** Opens an entry link in the app, and other links in a new tab. */
const openLink = (href: string, links: EditorLinks | undefined, newTab: boolean) => {
  const entryID = getLinkedEntryID(href);

  if (entryID) {
    links?.openEntry(entryID, newTab);
  } else {
    window.open(href, "_blank", "noopener,noreferrer");
  }
};
/**
 * Links: an icon at their start, with the caret on either side of it; `Mod`+click opens a link
 * while editing, a click while reading; app URLs of entries become `entry:` links; entry links
 * show whether their entry still exists.
 */
const Links = Extension.create<LinksOptions>({
  name: "links",
  addOptions() {
    return { links: () => undefined };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;

    // One position is both before a link and at its start: a click on the link's text or the
    // icon's right half puts the caret after the icon, others before it.
    const clickedSide = createClickedSide({
      isInside: (target, event) => {
        const icon = target.closest(".link-icon")?.getBoundingClientRect();
        const isIconLeftHalf = Boolean(icon && event.clientX < icon.left + icon.width / 2);

        return Boolean(target.closest("a[href]")) && !isIconLeftHalf;
      },
      setSide: (view, inside) => {
        view.dispatch(
          view.state.tr.setMeta(linksPluginKey, {
            linkStart: inside ? view.state.selection.from : null
          } satisfies LinksMeta)
        );
      }
    });

    return [
      new Plugin({
        key: linksPluginKey,
        state: {
          init: (_, state): LinksState => {
            return {
              decorations: getLinkDecorations(state.doc, options.links()),
              linkStart: null
            };
          },
          // The caret's side is kept through other changes, e.g. remote edits, until it moves.
          apply: (transaction, value, _, state): LinksState => {
            const meta = transaction.getMeta(linksPluginKey) as LinksMeta | undefined;
            const decorations =
              transaction.docChanged || meta === true
                ? getLinkDecorations(state.doc, options.links())
                : value.decorations;
            // Set by the arrow keys or a click, or kept: also through a remote change, whose
            // restored caret can differ from the mapped position.
            const getLinkStart = () => {
              const clicked = clickedSide.get([transaction]);

              if (typeof meta === "object") return meta.linkStart;
              if (clicked !== null) return clicked ? state.selection.from : null;
              if (value.linkStart === null) return null;

              return isRemoteChange(transaction)
                ? state.selection.from
                : transaction.mapping.map(value.linkStart, 1);
            };
            const linkStart = getLinkStart();
            const isCaretThere = state.selection.empty && state.selection.from === linkStart;
            const isLinkStart =
              linkStart !== null && Boolean(getLinkStartMarks(state.doc, linkStart));

            return { decorations, linkStart: isCaretThere && isLinkStart ? linkStart : null };
          }
        },
        props: {
          // The browser's caret is hidden at a link's start, where the drawn one shows.
          attributes: (state): Record<string, string> => {
            return isAtLinkStart(state) ? { class: BOUNDARY_CURSOR_ACTIVE_CLASS } : {};
          },
          decorations: (state) => {
            const { decorations, linkStart } = linksPluginKey.getState(state)!;
            const { selection } = state;

            if (!isAtLinkStart(state)) return decorations;

            // Before the icon, or after it (`side: 2`, after the icon's `1`) while "in" the link.
            return decorations.add(state.doc, [
              createBoundaryCursor(selection.from, linkStart === selection.from ? 2 : -1)
            ]);
          },
          // At a link's start, the arrow keys also stop on each side of the icon.
          handleKeyDown: (view, event) => {
            const { state } = view;
            const { selection } = state;
            const { linkStart } = linksPluginKey.getState(state)!;
            const isArrow = event.key === "ArrowLeft" || event.key === "ArrowRight";
            const isModified = event.shiftKey || event.altKey || event.metaKey || event.ctrlKey;

            if (!isArrow || isModified || !selection.empty) return false;

            const isIn = linkStart === selection.from;
            const isAtStart = Boolean(getLinkStartMarks(state.doc, selection.from));
            const isAfterFirstLetter =
              selection.from > 0 && Boolean(getLinkStartMarks(state.doc, selection.from - 1));
            // The browser's caret would only move to the icon's other side, the same position.
            const moveTo = (position: number, inLink = false) => {
              view.dispatch(
                state.tr
                  .setSelection(TextSelection.create(state.doc, position))
                  .setMeta(linksPluginKey, {
                    linkStart: inLink ? position : null
                  } satisfies LinksMeta)
              );

              return true;
            };

            if (event.key === "ArrowRight") {
              // |icon -> icon|, then icon|E -> iconE|.
              if (isAtStart && !isIn) return moveTo(selection.from, true);
              if (isIn) return moveTo(selection.from + 1);

              return false;
            }

            // icon| -> |icon, then |icon -> one letter before it; iconE| -> icon|E.
            if (isIn) return moveTo(selection.from);
            if (isAtStart && selection.$from.parentOffset > 0) return moveTo(selection.from - 1);
            if (isAfterFirstLetter) return moveTo(selection.from - 1, true);

            return false;
          },
          // While the caret is "in" a link at its start, typed text gets the link's marks.
          handleTextInput: (view, from, to, text) => {
            const { linkStart } = linksPluginKey.getState(view.state)!;
            const marks = linkStart === from ? getLinkStartMarks(view.state.doc, from) : null;

            if (!marks || from !== to) return false;

            const transaction = view.state.tr.replaceWith(
              from,
              to,
              view.state.schema.text(text, marks)
            );

            view.dispatch(
              transaction.setSelection(TextSelection.create(transaction.doc, from + text.length))
            );

            return true;
          },
          handleDOMEvents: {
            mousedown: clickedSide.mousedown,
            // The native click, not `handleClick`: a link opens on it, also in read-only views.
            click: (view, event) => {
              const target = event.target instanceof Element ? event.target : null;
              const anchor = target?.closest("a[href]");
              const isModified = event.metaKey || event.ctrlKey;

              if (!anchor || !view.dom.contains(anchor)) return false;

              event.preventDefault();

              if (editor.isEditable && !isModified) return true;

              openLink(
                anchor.getAttribute("href") || "",
                options.links(),
                !editor.isEditable && isModified
              );

              return true;
            }
          }
        },
        // Pasted, typed, or auto-linked app URLs of entries become entry links.
        appendTransaction: (transactions, oldState, newState) => {
          const links = options.links();
          const linkType = newState.schema.marks.link;
          const transaction = newState.tr;

          if (!links || !linkType || !transactions.some(({ docChanged }) => docChanged)) return;

          for (const { newRange } of getChangedRanges(
            combineTransactionSteps(oldState.doc, [...transactions])
          )) {
            newState.doc.nodesBetween(newRange.from, newRange.to, (node, pos) => {
              const mark = node.isText ? linkType.isInSet(node.marks) : undefined;
              const href = mark && links.toEntryLink(mark.attrs.href);

              if (!mark || !href) return;

              transaction.addMark(
                pos,
                pos + node.nodeSize,
                linkType.create({ ...mark.attrs, href })
              );
            });
          }

          return transaction.docChanged ? transaction : undefined;
        }
      })
    ];
  }
});

export { Links, linksPluginKey, openLink };
