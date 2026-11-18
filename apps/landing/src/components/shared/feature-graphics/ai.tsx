import styles from "./styles.module.scss";
import { Panel, Stage } from ".";
import { type Component } from "solid-js";
import clsx from "clsx";

// An Ask AI answer as the search palette shows it: the question, the answer, and its sources.
const AnswerSourcesGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-1.5 rounded-b-none p-3 text-xs">
      <span class="self-end rounded-lg bg-gray-100 px-2 py-1 text-gray-700">
        How do I rotate an API key?
      </span>
      <p class={clsx(styles.fadeIn, "leading-relaxed text-gray-700")}>
        Open the key's menu in Settings and select Rotate.{" "}
        <span class="text-tertiary underline">[1]</span>
      </p>
      {["API keys", "Settings"].map((title, index) => (
        <span class={clsx(styles.fadeIn, "flex items-center gap-1.5 text-gray-700")}>
          <span class="font-mono text-gray-400">[{index + 1}]</span>
          {title}
        </span>
      ))}
    </Panel>
  </Stage>
);
// The channel switch: answers come from the current drafts or only from published content.
const ChannelAnswerGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-2 rounded-b-none p-3 text-xs">
      <span class="flex self-start rounded-lg bg-gray-100 p-0.5 text-gray-500">
        <span class="px-2 py-0.5">Current</span>
        <span class={clsx(styles.pop, "rounded-md bg-white px-2 py-0.5 text-gray-700 shadow-sm")}>
          Published
        </span>
      </span>
      <span class="self-end rounded-lg bg-gray-100 px-2 py-1 text-gray-700">
        What's new in search?
      </span>
      <p class={clsx(styles.fadeIn, "leading-relaxed text-gray-700")}>
        Search now finds matching pages as you type.{" "}
        <span class="text-tertiary underline">[1]</span>
      </p>
    </Panel>
  </Stage>
);

export { AnswerSourcesGraphic, ChannelAnswerGraphic };
