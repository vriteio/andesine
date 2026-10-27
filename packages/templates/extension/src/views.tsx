import { defineViews } from "@andesine/extensions/solid";
import { CountWordsAction } from "./frontend/count-words-action";
import { HelloPanel } from "./frontend/hello-panel";
import { NoteView } from "./frontend/note-view";
import { ShoutAction } from "./frontend/shout-action";
import { WrapInNoteAction } from "./frontend/wrap-in-note-action";

// The frontend entry: the views that andesine.config.ts names with `View.<name>`.
const views = defineViews({
  CountWordsAction,
  HelloPanel,
  NoteView,
  ShoutAction,
  WrapInNoteAction
});

export type Views = typeof views;
export default views;
