import { Button, IconButton, Spinner } from "@andesine/components";
import { createMutation } from "@tanstack/solid-query";
import { revalidate } from "@solidjs/router";
import { type Component, createSignal, onCleanup, Show } from "solid-js";
import { client } from "#web/lib/api";
import { fromUUID, generateUUID } from "#web/lib/primitives";
import { isOffline } from "#web/lib/offline";
import { useWorkspace } from "#web/context/workspace";
import { useNotify } from "#web/context/notifications";
import { Setting } from "./setting";
import clsx from "clsx";

interface ImageSettingProps {
  target: "workspace" | "user";
}

const ImageSetting: Component<ImageSettingProps> = (props) => {
  const { currentWorkspace, currentSession, hasPermission, refreshWorkspaces } = useWorkspace();
  const notify = useNotify();
  const [dragging, setDragging] = createSignal(false);
  const [stage, setStage] = createSignal("Uploading image…");
  let input: HTMLInputElement | undefined;
  let controller: AbortController | undefined;

  const image = () =>
    props.target === "workspace" ? currentWorkspace()?.logo : currentSession()?.user.image;
  const refresh = () =>
    props.target === "workspace" ? refreshWorkspaces() : revalidate("sessions");
  const mutation = createMutation(() => ({
    mutationFn: async (file: File | null) => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const target = props.target;
      const options = {
        signal,
        context: { headers: { "x-workspace-id": currentWorkspace()?.id || "" } }
      };
      if (!file) {
        setStage("Removing image…");
        await client.assets.removeProfile({ target }, options);
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Choose a JPEG, PNG, or static WebP image");
      }
      const assetID = fromUUID(generateUUID(), "ast");
      setStage("Uploading image…");
      await client.assets.uploadProfile({ target, assetID, file }, options);
      setStage("Processing image…");
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        signal.throwIfAborted();
        const { body } = await client.assets.getProfileUpload({ target, assetID }, options);
        if (body.status === "ready") {
          await client.assets.setProfile({ target, assetID }, options);
          return;
        }
        if (body.status === "failed" || body.status === "deleting") {
          throw new Error(body.failureReason || "Image processing failed");
        }
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
          };
          const timer = setTimeout(() => {
            signal.removeEventListener("abort", abort);
            resolve();
          }, 1000);
          signal.addEventListener("abort", abort, { once: true });
        });
      }
      throw new Error("Image processing took too long. Try again.");
    },
    onSuccess: () => refresh(),
    onError: (error) => {
      if (controller?.signal.aborted) return;
      notify({ type: "error", text: error.message || "Failed to update image" });
    }
  }));
  const disabled = () =>
    isOffline() ||
    mutation.isPending ||
    (props.target === "workspace" && !hasPermission("workspace"));

  onCleanup(() => controller?.abort());

  return (
    <Setting
      label={props.target === "workspace" ? "Workspace logo" : "Profile image"}
      description="Public image. JPEG, PNG, or static WebP; resized to fit 512 × 512."
      fade={false}
    >
      <div class="flex w-full items-center justify-end gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          disabled={disabled()}
          aria-label="Choose image"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file && !disabled()) mutation.mutate(file);
          }}
        />
        <Show when={image()}>
          <IconButton
            size="small"
            variant="outlined"
            color="contrast"
            text="soft"
            icon="i-lucide:trash-2"
            disabled={disabled()}
            onClick={() => mutation.mutate(null)}
            label={() => <span class="pl-1 pr-0.5">Remove</span>}
            class="pr-1"
          />
        </Show>
        <button
          type="button"
          class={clsx(
            "group/image relative h-14 w-14 shrink-0 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-tertiary rounded-xl",
            disabled() ? "cursor-default" : "cursor-pointer"
          )}
          aria-label={image() ? "Replace image" : "Upload image"}
          aria-disabled={disabled()}
          aria-busy={mutation.isPending}
          onClick={() => {
            if (!disabled()) input?.click();
          }}
          onDragOver={(event) => {
            if (!event.dataTransfer?.types.includes("Files")) return;

            event.preventDefault();
            event.dataTransfer.dropEffect = disabled() ? "none" : "copy";
            setDragging(!disabled());
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;

            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer?.files[0];

            if (file && !disabled()) mutation.mutate(file);
          }}
        >
          <Show
            when={!mutation.isPending && image()}
            fallback={
              <div class="h-full w-full flex justify-center items-center pointer-events-none bg-gradient-to-tr">
                <div
                  class="absolute top-0 left-0 h-full w-full flex justify-center items-center bg-repeat bg-[url(/assets/noise.png)] mix-blend-overlay bg-blend-overlay"
                  style={{
                    "background-size": "6rem 6rem"
                  }}
                />
                <Show
                  when={mutation.isPending}
                  fallback={<div class="i-lucide:image-plus h-5 w-5 text-white" />}
                >
                  <Spinner class="h-5 w-5 text-white" />
                </Show>
              </div>
            }
          >
            {(url) => (
              <img
                src={url()}
                alt={props.target === "user" ? "Profile image" : "Workspace logo"}
                class="h-full w-full object-contain pointer-events-none"
                draggable={false}
              />
            )}
          </Show>
          <Show when={!disabled()}>
            <div
              class={clsx(
                "absolute inset-0 pointer-events-none flex items-center justify-center bg-tertiary/40 backdrop-blur-lg text-white transition-opacity rounded-xl",
                dragging()
                  ? "opacity-100 border-2 border-dashed border-tertiary rounded-inherit"
                  : "opacity-0 group-hover/image:opacity-100 group-focus-visible/image:opacity-100"
              )}
            >
              <div class="i-lucide:upload h-5 w-5" />
            </div>
          </Show>
          <Show when={mutation.isPending}>
            <span class="sr-only" role="status">
              {stage()}
            </span>
          </Show>
        </button>
      </div>
    </Setting>
  );
};

export { ImageSetting };
