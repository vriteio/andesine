import { createSignal, onCleanup } from "solid-js";
import clsx from "clsx";

interface ImageUploadPreviewProps {
  file: File;
  alt: string;
}

const ImageUploadPreview = (props: ImageUploadPreviewProps) => {
  const [loaded, setLoaded] = createSignal(false);
  const url = URL.createObjectURL(props.file);

  onCleanup(() => URL.revokeObjectURL(url));

  return (
    <div
      class={clsx(
        "absolute inset-0 pointer-events-none bg-gray-100 dark:bg-gray-900",
        !loaded() && "invisible"
      )}
      role="status"
      aria-label="Uploading and processing image"
    >
      <img
        src={url}
        alt={props.alt}
        draggable={false}
        class="h-full w-full object-contain select-none animate-pulse motion-reduce:animate-none"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
    </div>
  );
};

export { ImageUploadPreview };
