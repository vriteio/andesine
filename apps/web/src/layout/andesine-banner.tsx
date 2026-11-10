import { mdiClose, mdiInformationOutline } from "@mdi/js";
import { Icon } from "@vrite/components";
import { Component, Show, createSignal } from "solid-js";

const AndesineBanner: Component = () => {
  const [visible, setVisible] = createSignal(true);

  return (
    <Show when={visible()}>
      <div class="md:h-8 text-sm md:text-base flex-wrap bg-gradient-to-tr w-full flex justify-center items-center relative p-1 text-white z-30">
        <Icon
          path={mdiInformationOutline}
          class="h-6 w-6 absolute sm:relative top-1 left-1 sm:top-0 sm:left-0"
        />
        <span class="pl-1 pr-2">Vrite continues as Andesine.</span>
        <a
          href="https://andesine.app"
          target="_blank"
          class="font-semibold underline inline-flex justify-center items-center"
        >
          Try Andesine
        </a>
        <button
          class="rounded-md hover:bg-white hover:bg-opacity-20 absolute top-1 right-1 sm:top-0 sm:left-0 sm:relative ml-1"
          onClick={() => setVisible(false)}
        >
          <Icon path={mdiClose} class="h-6 w-6" />
        </button>
      </div>
    </Show>
  );
};

export { AndesineBanner };
