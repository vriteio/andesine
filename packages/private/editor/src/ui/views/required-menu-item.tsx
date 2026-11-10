import { Checkbox, type MenuItem } from "@andesine/components";

/** Toggles whether a schema field is required; entries can leave out the others. */
const createRequiredMenuItem = (required: boolean, setRequired: (value: boolean) => void) => {
  return {
    label: "Required",
    icon: () => (
      <span class="pointer-events-none flex">
        <Checkbox checked={required} controlClass="!h-4.5 !w-4.5" iconClass="!h-3.5 !w-3.5" />
      </span>
    ),
    closeOnSelect: false,
    onClick: () => setRequired(!required)
  } satisfies MenuItem;
};

export { createRequiredMenuItem };
