import { IconButton, Input } from "@andesine/components";
import { createSignal, onCleanup, onMount } from "solid-js";

interface ImageURLInputProps {
  disabled?: boolean;
  onSubmit(url: string): void;
}

const ImageURLInput = (props: ImageURLInputProps) => {
  const [url, setURL] = createSignal("");
  let input: HTMLInputElement | undefined;

  const submit = () => {
    if (props.disabled || !input) return;

    const value = url().trim();

    input.value = value;
    setURL(value);
    if (!input.reportValidity()) return;

    props.onSubmit(value);
    setURL("");
  };

  onMount(() => {
    const ownerWindow = input?.ownerDocument.defaultView;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.target !== input) return;

      event.preventDefault();
      event.stopPropagation();
      setURL("");
      input?.blur();
    };

    // The menu handles Escape on document capture, before input handlers run.
    ownerWindow?.addEventListener("keydown", handleEscape, true);
    onCleanup(() => ownerWindow?.removeEventListener("keydown", handleEscape, true));
  });

  return (
    <div class="flex w-full min-w-0 max-w-full flex-col gap-2 p-1">
      <Input
        ref={(element) => {
          input = element;
        }}
        class="w-full min-w-0 max-w-full bg-gray-50"
        labelWrapperClass="w-full min-w-0 max-w-full"
        label="Image URL"
        placeholder="https://..."
        type="url"
        pattern="https://.*"
        title="Enter a public HTTPS image URL"
        required
        maxLength={4096}
        value={url()}
        setValue={setURL}
        disabled={props.disabled}
        size="small"
        color="contrast"
        variant="outlined"
        onEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!event.isComposing && !event.repeat) submit();
        }}
        onKeyDown={(event) => event.stopPropagation()}
        slot={() => {
          return (
            <IconButton
              type="button"
              aria-label="Upload image from URL"
              icon="i-lucide:arrow-right"
              class="ml-1.5"
              size="small"
              variant="outlined"
              color="primary"
              disabled={props.disabled || !url().trim()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                submit();
              }}
            />
          );
        }}
      />
    </div>
  );
};

export { ImageURLInput };
