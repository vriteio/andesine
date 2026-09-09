import { Dialog, IconButton, Tooltip } from "@andesine/components";
import { createSignal, Show } from "solid-js";
import type { EditorImageDuplicate, EditorImageDuplicateHandler } from "#editor/client-types";

interface DuplicatePrompt {
  image: EditorImageDuplicate;
  choose(choice: "reuse" | "upload" | "cancel"): void;
}
const createImageDuplicatePrompt = () => {
  const [duplicatePrompt, setDuplicatePrompt] = createSignal<DuplicatePrompt | null>(null);
  const confirm = (
    image: EditorImageDuplicate,
    signal: AbortSignal
  ): ReturnType<EditorImageDuplicateHandler> =>
    new Promise((resolve) => {
      const choose: DuplicatePrompt["choose"] = (choice) => {
        signal.removeEventListener("abort", abort);
        setDuplicatePrompt(null);
        resolve(choice);
      };
      const abort = () => choose("cancel");

      if (signal.aborted) return resolve("cancel");
      signal.addEventListener("abort", abort, { once: true });
      setDuplicatePrompt({ image, choose });
    });

  const render = () => (
    <Show when={duplicatePrompt()}>
      {(prompt) => (
        <Dialog
          opened
          portal
          size="small"
          cardClass="relative"
          aria-label="Image already exists"
          onOverlayClick={() => prompt().choose("cancel")}
        >
          <Tooltip content="Close" wrapperClass="absolute right-2 top-2" placement="left">
            <IconButton
              variant="text"
              text="soft"
              size="small"
              icon="i-lucide:x"
              aria-label="Cancel image upload"
              onClick={() => prompt().choose("cancel")}
            />
          </Tooltip>
          <div class="flex flex-col gap-0.5">
            <h3 class="pr-6 text-lg font-semibold leading-tight">Image already exists</h3>
            <p class="text-sm leading-tight text-gray-400">
              This file matches an existing image. Use it to avoid another upload.
            </p>
          </div>
          <div class="flex min-w-0 flex-col rounded-lg bg-gray-100 px-2 py-1.5 gap-1.5">
            <div class="min-w-0 text-sm leading-tight">
              <p class="truncate font-medium">{prompt().image.filename}</p>
              <p class="truncate text-gray-400 text-xs">
                Used in "<span class="text-gray-500">{prompt().image.entryName}</span>"
              </p>
            </div>
            <img
              src={prompt().image.thumbnailURL}
              alt=""
              class="h-28 w-full object-contain"
              draggable={false}
            />
          </div>
          <div class="flex flex-col gap-1">
            <IconButton
              icon="i-lucide:image"
              iconProps={{ class: "h-4 w-4" }}
              size="small"
              class="w-full"
              variant="outlined"
              color="primary"
              label="Use existing image"
              onClick={() => prompt().choose("reuse")}
            />
            <div class="flex items-center gap-2 text-xs text-gray-400">
              <div class="h-px flex-1 bg-gray-200" />
              Or
              <div class="h-px flex-1 bg-gray-200" />
            </div>
            <IconButton
              icon="i-lucide:upload"
              iconProps={{ class: "h-4 w-4 text-gray-400" }}
              size="small"
              class="w-full"
              variant="outlined"
              color="contrast"
              label="Upload anyway"
              onClick={() => prompt().choose("upload")}
            />
          </div>
        </Dialog>
      )}
    </Show>
  );

  return { confirm, render };
};

export { createImageDuplicatePrompt };
