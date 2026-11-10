import Accordion from "./accordion.astro";
import Callout from "./callout.astro";
import Card from "./card.astro";
import CardGrid from "./card-grid.astro";
import CodeBlock from "./code-block.astro";
import CodeGroup from "./code-group.astro";
import File from "./file.astro";
import FileTree from "./file-tree.astro";
import Folder from "./folder.astro";
import Figure from "./figure.astro";
import Step from "./step.astro";
import Steps from "./steps.astro";
import Tab from "./tab.astro";
import Tabs from "./tabs.astro";
import Operation from "../reference/operation.astro";

/** Components for MDX content: custom elements, `pre` for code blocks, and API operations. */
const components = {
  Accordion,
  Callout,
  Card,
  CardGrid,
  CodeGroup,
  File,
  FileTree,
  Figure,
  Folder,
  Operation,
  Step,
  Steps,
  Tab,
  Tabs,
  pre: CodeBlock
};

export { components };
