import styles from "./styles.module.scss";
import { Panel, Stage } from ".";
import { type Component } from "solid-js";
import clsx from "clsx";

// The SDK snippet from the docs, in a code block with a tab for each way in.
const CodeTabsGraphic: Component = () => (
  <div aria-hidden="true" class={clsx(styles.panel, "overflow-hidden text-sm")} data-entry="up">
    <div class="flex items-center gap-4 border-b border-gray-200 px-4 pt-2 font-mono text-xs text-gray-500">
      <span class="pb-2">cURL</span>
      <span class="relative pb-2 text-tertiary">
        TypeScript
        <span class="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-tr" />
      </span>
      <span class="pb-2">CLI</span>
      <span class="i-lucide:copy ml-auto mb-2 h-4 w-4 text-gray-400" />
    </div>
    <div class="flex flex-col gap-0.5 overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-gray-700 md:text-sm">
      {[
        <>
          <span class="text-red-600">import</span> {"{ createClient }"}{" "}
          <span class="text-red-600">from</span> "@andesine/sdk";
        </>,
        <></>,
        <>
          <span class="text-red-600">const</span> client ={" "}
          <span class="text-purple-600">createClient</span>();
        </>,
        <>
          <span class="text-red-600">const</span> page = <span class="text-red-600">await</span>{" "}
          client.content.
          <span class="text-purple-600">get</span>({"{"}
        </>,
        <span class="pl-4">
          <span class="text-blue-600">path</span>: "/Docs/Quickstart",
        </span>,
        <span class="pl-4">
          <span class="text-blue-600">channel</span>: "published"
        </span>,
        <>{"});"}</>
      ].map((line, index) => (
        <div class="flex gap-4">
          <span class="w-4 shrink-0 text-right text-gray-400">{index + 1}</span>
          <span class="whitespace-pre">{line}</span>
        </div>
      ))}
    </div>
  </div>
);
// Webhook deliveries, where the icon's color is the delivery's status.
const WebhookGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-1 rounded-b-none p-1.5 text-xs">
      {[
        ["i-lucide:circle-check text-green-500", "publishing.channel_advanced", "200 · 2m ago"],
        ["i-lucide:circle-check text-green-500", "entry.updated", "200 · 5m ago"],
        ["i-lucide:clock text-tertiary", "entry.created", "Retrying"]
      ].map(([icon, event, details], index) => (
        <div
          class={clsx(
            "flex items-center gap-2 rounded-lg px-1.5 py-1",
            index === 0 && "bg-gray-100"
          )}
        >
          <span class={clsx(icon, index === 0 && styles.pop, "h-4 w-4 shrink-0")} />
          <span class="flex min-w-0 flex-col">
            <span class="truncate font-mono text-gray-700">{event}</span>
            <span class="text-gray-500">{details}</span>
          </span>
        </div>
      ))}
    </Panel>
  </Stage>
);
// API keys: a secret key for servers and a publishable key for browsers.
const ApiKeysGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-1 rounded-b-none p-1.5 text-xs">
      {[
        ["i-lucide:server", "Build server", "adn_…", "Secret"],
        ["i-lucide:globe", "Docs site", "adn_pk_…", "Publishable"]
      ].map(([icon, name, prefix, kind]) => (
        <div class="flex items-center gap-2 rounded-lg px-1.5 py-1">
          <span class={clsx(icon, "h-4 w-4 shrink-0 text-gray-400")} />
          <span class="flex min-w-0 flex-col">
            <span class="font-medium text-gray-700">{name}</span>
            <span class="text-gray-500">{kind}</span>
          </span>
          <span class="ml-auto rounded-md bg-gray-100 px-1.5 font-mono text-tertiary">
            {prefix}
          </span>
        </div>
      ))}
      <span class={clsx(styles.fadeIn, "mx-1.5 mt-1 flex items-center gap-1.5 text-gray-500")}>
        <span class="i-lucide:shield-check h-3.5 w-3.5 text-green-500" />
        Only docs.acme.com can use the publishable key
      </span>
    </Panel>
  </Stage>
);

export { CodeTabsGraphic, WebhookGraphic, ApiKeysGraphic };
