import Callout from "./callout.astro";
import Card from "./card.astro";
import CardGrid from "./card-grid.astro";
import CodeBlock from "./code-block.astro";
import CodeGroup from "./code-group.astro";
import Disclosure from "./disclosure.astro";
import FileTree from "./file-tree.astro";
import Figure from "./figure.astro";
import Steps from "./steps.astro";
import Tab from "./tab.astro";
import Tabs from "./tabs.astro";
import Operation from "../reference/operation.astro";

/** Components for MDX content: custom elements, `pre` for code blocks, and API operations. */
const components = {
  Callout,
  Card,
  CardGrid,
  CodeGroup,
  Disclosure,
  FileTree,
  Figure,
  Operation,
  Steps,
  Tab,
  Tabs,
  pre: CodeBlock
};

export { components };
