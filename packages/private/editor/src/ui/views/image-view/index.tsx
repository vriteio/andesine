import { ImageResizeHandles } from "./resize-handles";
import { ImageUploadPreview } from "./upload-preview";
import { getImageSize, readImageDimensions } from "#editor/lib/image-dimensions";
import type { ImageAttributes } from "#editor/schema/blocks/image";
import { createImageDuplicatePrompt } from "./duplicate-prompt";
import { createImageResize } from "./resize";
import { BLOCK_CONTROL_SIZE } from "#editor/ui/constants";
import { ImagePlaceholder } from "./placeholder";
import { hasFileDrag, hasImageURL, readImageDrop } from "#editor/lib/image-drop";
import {
  createEffect,
  createMemo,
  createSignal,
  onMount,
  onCleanup,
  Show,
  untrack,
  type Accessor
} from "solid-js";
import clsx from "clsx";
import type {
  EditorImageAsset,
  EditorImages,
  EditorImageDuplicateHandler
} from "#editor/client-types";
import { isBlockSelection } from "#editor/extensions/block-selection";
import {
  createNodeViewRenderer,
  type NodeViewComponentProps
} from "#editor/lib/create-node-view-renderer";
import { Skeleton } from "@andesine/components";

interface ImageViewProps extends NodeViewComponentProps<ImageAttributes> {
  images: Accessor<EditorImages | undefined>;
}

const ImageView = (props: ImageViewProps) => {
  const duplicatePrompt = createImageDuplicatePrompt();
  const [pickerOpened, setPickerOpened] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  const [url, setURL] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [uploadFile, setUploadFile] = createSignal<File | null>(null);
  const [dragging, setDragging] = createSignal(false);
  const [attempt, setAttempt] = createSignal(0);
  const attrs = () => props.node().attrs as ImageAttributes;
  const assetID = createMemo(() => attrs().assetID);
  const uploading = () =>
    busy() || props.editor.storage.collaboration?.imageUploads().has(props.node().attrs.id);
  const loading = () => uploading() || Boolean(assetID() && !loaded() && !error());
  const canUpload = () => props.editable() && props.images()?.enabled() && !uploading();
  const aspectRatio = () => {
    const ratio = attrs().aspectRatio;

    return ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9;
  };
  const size = () => Math.min(100, Math.max(20, resize.size() ?? attrs().size ?? 100));
  let figure: HTMLElement | undefined;
  let fileInput: HTMLInputElement | undefined;
  let uploadSource: File | string | EditorImageAsset | undefined;
  let uploadController: AbortController | undefined;
  let objectURL: string | undefined;
  let displayedAssetID: string | null = null;

  const resize = createImageResize({
    enabled: () => props.editable() && Boolean(assetID() || uploading() || attrs().aspectRatio),
    nodeID: () => props.node().attrs.id,
    size: () => attrs().size ?? 100,
    width: () => figure?.clientWidth ?? 0,
    save: (size) => props.updateAttributes({ size })
  });

  createEffect(() => {
    const nodeID = props.node().attrs.id;
    const collaboration = props.editor.storage.collaboration;

    if (!busy() || !collaboration) return;
    collaboration.setImageUploading(nodeID, true);
    onCleanup(() => collaboration.setImageUploading(nodeID, false));
  });

  const clearImage = () => {
    setLoaded(false);
    setURL(null);
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = undefined;
  };

  createEffect(() => {
    const currentAssetID = assetID();
    const images = props.images();
    const controller = new AbortController();
    const showFile = (file: Blob) => {
      if (controller.signal.aborted || objectURL) return;
      objectURL = URL.createObjectURL(file);
      setURL(objectURL);
    };

    attempt();
    images?.enabled();
    if (displayedAssetID !== currentAssetID) {
      clearImage();
      displayedAssetID = currentAssetID;
    }
    setError("");

    if (currentAssetID && images) {
      void untrack(() => images.load(currentAssetID, controller.signal, showFile))
        .then(showFile)
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          clearImage();
          setError(error instanceof Error ? error.message : "Image is not available");
        });
    } else if (currentAssetID && !images) {
      setError("Image is not available in this view");
    }
    onCleanup(() => controller.abort());
  });
  onCleanup(() => {
    uploadController?.abort();
    clearImage();
  });

  const upload = async (file: File | string | EditorImageAsset) => {
    const images = props.images();
    const nodeID = props.node().attrs.id;
    const initialSize = attrs().size;
    const initialAspectRatio = attrs().aspectRatio;

    if (!images || !canUpload()) return;
    uploadController?.abort();
    uploadController = new AbortController();
    const controller = uploadController;
    const confirmDuplicate: EditorImageDuplicateHandler = (image) =>
      duplicatePrompt.confirm(image, controller.signal);

    uploadSource = file;
    setBusy(true);
    setError("");

    try {
      setUploadFile(file instanceof File ? file : null);
      const dimensions =
        file instanceof File
          ? await readImageDimensions(file, controller.signal)
          : typeof file === "object"
            ? file
            : null;
      if (controller.signal.aborted) return;
      if (dimensions && props.editable() && images.enabled() && props.node().attrs.id === nodeID) {
        props.updateAttributes({
          aspectRatio: dimensions.width / dimensions.height,
          size:
            resize.size() ??
            (attrs().size !== initialSize
              ? attrs().size
              : getImageSize(dimensions.width, figure?.clientWidth ?? 0))
        });
      }
      const image = await (typeof file === "string"
        ? images.uploadURL(file, controller.signal, confirmDuplicate)
        : file instanceof File
          ? images.upload(file, controller.signal, confirmDuplicate)
          : images.attach([file.assetID], controller.signal).then(() => file));

      if (!image && !controller.signal.aborted && props.node().attrs.id === nodeID) {
        props.updateAttributes({ aspectRatio: initialAspectRatio, size: initialSize });
      }
      if (
        image &&
        !controller.signal.aborted &&
        props.editable() &&
        images.enabled() &&
        props.node().attrs.id === nodeID
      )
        props.updateAttributes({
          assetID: image.assetID,
          aspectRatio: image.width / image.height,
          size:
            resize.size() ??
            (dimensions || attrs().size !== initialSize
              ? attrs().size
              : getImageSize(image.width, figure?.clientWidth ?? 0))
        });
      uploadSource = undefined;
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadFile(null);
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  onMount(() => {
    const openPicker = () => {
      if (canUpload()) setPickerOpened(true);
    };
    const handleUpload = (event: Event) => {
      if (
        event instanceof CustomEvent &&
        (event.detail instanceof File || typeof event.detail === "string")
      )
        void upload(event.detail);
    };

    const dragOver = (event: DragEvent) => {
      if (props.editor.view.dragging) return;
      if (!hasFileDrag(event) && !hasImageURL(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = canUpload() ? "copy" : "none";
      setDragging(Boolean(canUpload()));
    };
    const dragLeave = (event: DragEvent) => {
      if (!(event.relatedTarget instanceof Node) || !figure?.contains(event.relatedTarget))
        setDragging(false);
    };
    const clearDrag = () => setDragging(false);
    const drop = (event: DragEvent) => {
      if (props.editor.view.dragging) return;
      if (!hasFileDrag(event) && !hasImageURL(event)) return;
      event.preventDefault();
      event.stopPropagation();
      clearDrag();
      const source = readImageDrop(event);

      if (source) void upload(source);
      else if (canUpload()) setError("Drop an image file or an image URL");
    };

    figure?.addEventListener("image-picker", openPicker);
    figure?.addEventListener("image-upload", handleUpload);
    figure?.addEventListener("dragover", dragOver);
    figure?.addEventListener("dragleave", dragLeave);
    figure?.addEventListener("drop", drop);
    window.addEventListener("dragend", clearDrag);
    window.addEventListener("drop", clearDrag);
    onCleanup(() => {
      figure?.removeEventListener("image-picker", openPicker);
      figure?.removeEventListener("image-upload", handleUpload);
      figure?.removeEventListener("dragover", dragOver);
      figure?.removeEventListener("dragleave", dragLeave);
      figure?.removeEventListener("drop", drop);
      window.removeEventListener("dragend", clearDrag);
      window.removeEventListener("drop", clearDrag);
    });
  });

  return (
    <figure
      class="not-prose relative my-3 [-webkit-touch-callout:none]"
      contentEditable={false}
      data-image-block
      ref={figure}
      onContextMenu={() => {
        const pos = props.getPos();
        const { selection } = props.editor.state;

        if (!props.editable() || pos === undefined) return;

        const alreadySelected =
          isBlockSelection(selection) &&
          selection.from <= pos &&
          selection.to >= pos + props.node().nodeSize;

        if (alreadySelected) return;

        props.editor.commands.setBlockSelection({
          from: pos,
          to: pos + props.node().nodeSize,
          depth: props.editor.state.doc.resolve(pos).depth
        });
      }}
    >
      {duplicatePrompt.render()}
      <Show when={pickerOpened() && canUpload()}>
        {props.images()?.renderPicker?.({
          onClose: () => setPickerOpened(false),
          onSelect: (image) => {
            setPickerOpened(false);
            void upload(image);
          }
        })}
      </Show>
      <span
        data-block-control-anchor
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: `${BLOCK_CONTROL_SIZE}px` }}
      />
      <input
        ref={fileInput}
        data-image-upload
        class="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={!canUpload()}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void upload(file);
        }}
      />
      <div
        class="group relative mx-auto overflow-hidden rounded-lg"
        style={{
          "aspect-ratio": aspectRatio(),
          "width": `${size()}%`
        }}
        aria-busy={loading()}
      >
        <Show when={url()}>
          {(source) => (
            <img
              draggable={false}
              loading="eager"
              decoding="async"
              class="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
              src={source()}
              alt={attrs().alt || ""}
              onError={() => {
                clearImage();
                setError("Image could not be displayed. Try again.");
              }}
              onLoad={(event) => {
                setLoaded(true);
                if (!props.editable()) return;
                const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
                if (!width || !height) return;
                if (attrs().aspectRatio && attrs().size !== null) return;
                props.updateAttributes({
                  aspectRatio: width / height,
                  size: attrs().size ?? getImageSize(width, figure?.clientWidth ?? 0)
                });
              }}
            />
          )}
        </Show>
        <Show when={loading() && !uploading()}>
          <Skeleton class="absolute inset-0" aria-label="Loading image" />
        </Show>
        <Show when={!assetID() || uploading() || error()}>
          <ImagePlaceholder
            title={
              uploading()
                ? "Uploading and processing…"
                : error()
                  ? "Image is not available"
                  : "Add an image"
            }
            loading={Boolean(uploading())}
            description={
              error() ||
              (uploading()
                ? "Your image will appear here when ready"
                : canUpload()
                  ? "Click or drop an image file or image URL"
                  : "Connect to upload an image")
            }
            error={Boolean(error())}
            action={error() ? "Retry image" : undefined}
            onAction={() => {
              if (uploadSource) void upload(uploadSource);
              else if (assetID()) setAttempt((value) => value + 1);
              else if (canUpload()) fileInput?.click();
            }}
          />
          <Show when={!assetID() && !uploading() && !error()}>
            <>
              <button
                type="button"
                class="absolute inset-0 h-full w-full cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Upload image"
                disabled={!canUpload()}
                onClick={() => fileInput?.click()}
              />
              <Show when={props.images()?.renderPicker}>
                <button
                  type="button"
                  class="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-white/20 px-2 py-1 text-xs text-white hover:bg-white/30"
                  disabled={!canUpload()}
                  onClick={() => setPickerOpened(true)}
                >
                  Choose existing
                </button>
              </Show>
            </>
          </Show>
        </Show>
        <Show when={uploadFile()} keyed>
          {(file) => <ImageUploadPreview file={file} alt={attrs().alt || ""} />}
        </Show>
        <Show when={props.editable() && (assetID() || uploading() || attrs().aspectRatio)}>
          <ImageResizeHandles resize={resize} />
        </Show>
        <Show when={dragging()}>
          <div
            class={clsx(
              "absolute inset-0 z-2 pointer-events-none rounded-lg bg-tertiary/40 backdrop-blur-lg flex items-center justify-center p-4 text-center text-white",
              assetID() && "border border-2 border-tertiary border-dashed"
            )}
          >
            <span class="text-xs font-medium">
              {assetID() ? "Drop image file or URL to replace" : "Drop image file or URL to upload"}
            </span>
          </div>
        </Show>
      </div>
      <Show when={attrs().caption}>
        <figcaption class="mt-2 whitespace-pre-wrap text-center text-sm text-gray-400">
          {attrs().caption}
        </figcaption>
      </Show>
    </figure>
  );
};
const createImageViewRenderer = (
  owner: unknown,
  editable: Accessor<boolean>,
  images: Accessor<EditorImages | undefined>
) => {
  return createNodeViewRenderer<ImageAttributes>(
    (props) => <ImageView {...props} images={images} />,
    {
      attributes: { "data-image-node-view": "" },
      stopEvent: (event) => {
        if (event.type === "dragstart") {
          event.preventDefault();
          return true;
        }
        return Boolean((event.target as HTMLElement | null)?.closest("input,button"));
      },
      ignoreMutation: () => true
    }
  )(owner, editable);
};

export { createImageViewRenderer };
