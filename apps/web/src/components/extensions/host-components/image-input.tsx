import { Button, IconButton, Tooltip } from "@andesine/components";
import { extensionImageFormats, MAX_EXTENSION_IMAGE_SIZE } from "@andesine/contracts/extensions";
import { isDeclaredURL } from "#web/lib/extensions";
import clsx from "clsx";
import { type Component, createSignal, Show } from "solid-js";
import { type HostComponentProps } from "./types";

type ImageFormat = keyof typeof extensionImageFormats;

const DEFAULT_FORMATS: ImageFormat[] = ["png", "jpeg", "webp", "svg"];
const FORMAT_LABELS: Record<ImageFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  gif: "GIF",
  svg: "SVG",
  ico: "ICO"
};
// Browsers may leave out the media type of some files, e.g. ICO; the name's extension decides then.
const EXTENSION_FORMATS: Record<string, ImageFormat> = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  webp: "webp",
  gif: "gif",
  svg: "svg",
  ico: "ico"
};

const formatSize = (bytes: number): string => {
  return bytes >= 1024 * 1024
    ? `${Math.round(bytes / 1024 / 102.4) / 10} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
};
const getMediaType = (file: File, formats: ImageFormat[]): string | null => {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = EXTENSION_FORMATS[extension];
  const accepted = formats.flatMap((item) => extensionImageFormats[item] as readonly string[]);

  if (file.type) return accepted.includes(file.type) ? file.type : null;

  return format && formats.includes(format) ? extensionImageFormats[format][0] : null;
};
const readBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("The file couldn't be read"));
    reader.readAsDataURL(file);
  });
};
/** Choose or drop an image; the format and size are checked before the extension gets the file. */
const ImageInput: Component<HostComponentProps<"ImageInput">> = (props) => {
  const [dragging, setDragging] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const formats = () => props.props.accept ?? DEFAULT_FORMATS;
  const maxSize = () =>
    Math.min(props.props.maxSize ?? MAX_EXTENSION_IMAGE_SIZE, MAX_EXTENSION_IMAGE_SIZE);
  const preview = () => {
    const value = props.props.value;
    const isShown =
      value?.startsWith("data:image/") || (value && isDeclaredURL(value, props.sources));

    return isShown ? value : null;
  };
  const formatLabels = () =>
    formats()
      .map((format) => FORMAT_LABELS[format])
      .join(", ");
  const hint = () => `Click or drop: ${formatLabels()} up to ${formatSize(maxSize())}`;
  const accept = () => {
    return formats()
      .flatMap((format) => [
        ...extensionImageFormats[format],
        `.${format === "jpeg" ? "jpg" : format}`
      ])
      .join(",");
  };

  let input!: HTMLInputElement;

  const open = () => {
    if (!props.props.disabled) input.click();
  };
  const choose = async (file?: File) => {
    const type = file && getMediaType(file, formats());

    if (!file || props.props.disabled) return;

    if (!type) {
      setError(`Use ${formatLabels()}`);
      return;
    }

    if (file.size > maxSize()) {
      setError(`The image is larger than ${formatSize(maxSize())}`);
      return;
    }

    try {
      const data = await readBase64(file);

      setError(null);
      props.emit("onChange", { name: file.name.slice(0, 255), type, size: file.size, data });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The file couldn't be read");
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={props.props.disabled ? -1 : 0}
        aria-disabled={props.props.disabled}
        class={clsx(
          "flex w-full min-w-0 items-start gap-3 rounded-lg border border-dashed p-2 outline-none transition focus-visible:ring-2 focus-visible:ring-gray-400",
          dragging() ? "border-gray-500 bg-gray-50" : "border-gray-300",
          props.props.disabled
            ? "cursor-default opacity-50"
            : "cursor-pointer media-mouse:hover:bg-gray-50"
        )}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;

          event.preventDefault();
          open();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(!props.props.disabled);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void choose(event.dataTransfer?.files[0]);
        }}
      >
        <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100">
          <Show when={preview()} fallback={<span class="i-lucide:image h-5 w-5 text-gray-400" />}>
            {(src) => (
              <img
                src={src()}
                alt=""
                referrerPolicy="no-referrer"
                class="max-h-full max-w-full object-contain"
              />
            )}
          </Show>
        </div>
        <div class="flex min-w-0 flex-1 flex-col items-start">
          <div class="flex flex-col items-start h-14">
            <span class="text-sm font-medium">
              {props.props.value ? "Replace the image" : "Choose an image"}
            </span>
            <span class={clsx("text-xs", error() ? "text-red-500" : "text-gray-500")}>
              {error() ?? hint()}
            </span>
          </div>
          <Show when={props.props.value}>
            <Tooltip content="Remove" wrapperClass="absolute top-2 right-2">
              <IconButton
                variant="danger"
                size="xs"
                icon="i-lucide:trash-2"
                iconProps={{
                  class: "h-3.5 w-3.5"
                }}
                aria-label="Remove"
                disabled={props.props.disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  props.emit("onRemove");
                }}
                onKeyDown={(event) => event.stopPropagation()}
              />
            </Tooltip>
          </Show>
        </div>
      </div>
      {/* Outside the area: the input's click event would otherwise open the picker again. */}
      <input
        ref={input}
        type="file"
        class="hidden"
        accept={accept()}
        disabled={props.props.disabled}
        onChange={(event) => {
          void choose(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
    </>
  );
};

export { ImageInput };
