import type { FileTreeItem } from "./content/mdx-components";

interface Slots {
  has(name: string): boolean;
  render(name: string, args?: unknown[]): Promise<string>;
}

/**
 * Renders the panels of a tabbed component. MDX passes named slots `tab-0`, `tab-1`, and so on;
 * Andesine content passes a default slot function that takes the panel index.
 */
const renderPanels = (slots: Slots, count: number): Promise<string[]> => {
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const html = slots.has(`tab-${index}`)
        ? await slots.render(`tab-${index}`)
        : await slots.render("default", [index]);

      // Function slots return an `HTMLString` object; islands need a plain string.
      return String(html);
    })
  );
};

/**
 * Reads the tabs of a tabbed component: its labels, from the `values` prop that the Andesine MDX
 * plugin and content renderer add, and its rendered panels.
 */
const renderTabs = async (
  values: string,
  slots: Slots
): Promise<{ values: string[]; panels: string[] }> => {
  const labels: string[] = JSON.parse(values);

  return { values: labels, panels: await renderPanels(slots, labels.length) };
};
/** Reads the `items` prop of a file tree: JSON from the Andesine MDX plugin, or nested items. */
const readFileTreeItems = (items: string | FileTreeItem[]): FileTreeItem[] => {
  return typeof items === "string" ? JSON.parse(items) : items;
};

export { renderTabs, readFileTreeItems };
export { getOperationView } from "./sources/openapi/embed";
export type { OperationProps } from "./sources/openapi/embed";
