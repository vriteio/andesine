import styles from "./styles.module.scss";
import { type Component, type ParentComponent } from "solid-js";
import clsx from "clsx";

interface PanelProps {
  class?: string;
  late?: boolean;
}

interface MenuProps {
  class?: string;
  items: string[];
  selected: string;
}

const gradientText = "bg-gradient-to-tr bg-clip-text text-transparent";

// Small compositions of the app UI; they explain features and are not product screenshots.
const Stage: ParentComponent = (props) => (
  <div aria-hidden="true" class={styles.stage}>
    {props.children}
  </div>
);
const Panel: ParentComponent<PanelProps> = (props) => (
  <div class={clsx(styles.panel, props.late && styles.late, props.class)}>{props.children}</div>
);
const Menu: Component<MenuProps> = (props) => (
  <Panel late class={clsx("absolute flex flex-col gap-0.5 p-1 text-xs", props.class)}>
    {props.items.map((item) => (
      <span
        class={clsx(
          "flex items-center justify-between rounded-lg px-2 py-1",
          item === props.selected ? "bg-gray-100 text-gray-700" : "text-gray-500"
        )}
      >
        {item}
        {item === props.selected && (
          <span class={clsx(styles.pop, "i-lucide:check h-3.5 w-3.5 text-tertiary")} />
        )}
      </span>
    ))}
  </Panel>
);
// Crossfades a value from its earlier state to its final one.
const Swap: Component<{ from: string; to: string; class?: string }> = (props) => (
  <span class={clsx("relative inline-grid", props.class)}>
    <span class={clsx(styles.fadeOut, "col-start-1 row-start-1")}>{props.from}</span>
    <span class={clsx(styles.fadeIn, "col-start-1 row-start-1")}>{props.to}</span>
  </span>
);

const HostedSiteGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col rounded-b-none">
      <div class="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
        <span class="i-lucide:globe h-3.5 w-3.5 text-gray-400" />
        <span class="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
          docs.andesine.page
        </span>
      </div>
      <div class="flex flex-1 text-xs">
        <div class="flex w-24 shrink-0 flex-col gap-1.5 border-r border-gray-200 px-3 py-2 text-gray-500">
          <span class="font-semibold text-gray-700">Guides</span>
          <span>Quickstart</span>
          <span class={clsx(gradientText, "font-semibold")}>Publishing</span>
          <span>Channels</span>
        </div>
        <div class="flex-1 px-3 py-2">
          <span class="text-sm font-semibold text-gray-700">Publishing</span>
          <p class="mt-1 leading-snug text-gray-500">Choose which version readers see.</p>
        </div>
      </div>
    </Panel>
    <Panel late class="absolute bottom-3 right-3 w-44 p-2 text-xs">
      <div class="flex items-center gap-1.5 font-medium text-gray-700">
        <span class="i-lucide:sparkles h-3.5 w-3.5 text-tertiary" />
        How do I publish?
      </div>
      <p class={clsx(styles.fadeIn, "mt-1 leading-snug text-gray-500")}>
        Select Publish current in the entry menu.
      </p>
      <span
        class={clsx(styles.pop, "mt-1.5 inline-block rounded-md bg-gray-100 px-1.5 text-gray-500")}
      >
        1 · Publishing
      </span>
    </Panel>
  </Stage>
);

const ContentAPIGraphic: Component = () => (
  <Stage>
    <Panel class="absolute left-4 top-4 w-[68%] p-3 font-mono text-xs leading-relaxed text-gray-700">
      <div>
        <span class="text-gray-400">await</span> client.content.get({"{"}
      </div>
      <div class="pl-3">
        path: <span class="text-gray-500">"/Changelog/v2"</span>,
      </div>
      <div class="pl-3">
        channel: <span class="text-gray-500">"published"</span>
      </div>
      <div>{"});"}</div>
    </Panel>
    <Panel
      late
      class="absolute bottom-4 right-4 w-[64%] p-3 font-mono text-xs leading-relaxed text-gray-500"
    >
      <div>
        "<span class={clsx(gradientText, "font-semibold")}>releaseDate</span>": "2026-11-09",
      </div>
      <div>
        "<span class={clsx(gradientText, "font-semibold")}>summary</span>": "Faster search…",
      </div>
      <div>
        "<span class={clsx(gradientText, "font-semibold")}>content</span>": [ … ]
      </div>
    </Panel>
  </Stage>
);

const PublishingGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-6 bottom-0 top-4 rounded-b-none text-xs">
      <div class="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span class="font-semibold text-gray-700">Explorer</span>
        <span class="flex items-center gap-1 rounded-lg border border-gray-200 px-1.5 py-0.5 text-gray-500">
          Channel:
          <Swap from="Published" to="Staging" class="font-medium text-gray-700" />
          <span class="i-lucide:chevron-down h-3 w-3" />
        </span>
      </div>
      <div class="flex flex-col gap-1 p-2 text-gray-600">
        {[
          ["Quickstart", "text-green-500"],
          ["Release notes", "text-amber-500"],
          ["Pricing", "text-gray-300"]
        ].map(([name, status]) => (
          <span class="flex items-center gap-1.5 px-1">
            <span class="i-lucide:file-text h-3.5 w-3.5 text-gray-400" />
            {name}
            <span class={clsx("i-lucide:radio ml-auto h-3 w-3", status)} />
          </span>
        ))}
      </div>
    </Panel>
    <Menu
      class="right-8 top-12 w-28"
      items={["Published", "Staging", "Preview"]}
      selected="Staging"
    />
  </Stage>
);

const HistoryGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-6 bottom-0 top-4 rounded-b-none text-xs">
      <div class="border-b border-gray-200 px-3 py-2 font-semibold text-gray-700">Versions</div>
      <div class="flex flex-col gap-0.5 p-1.5">
        {[
          ["Automatic", "14:20 · Sam", false],
          ["Reviewed by legal", "11:05 · Alex, Sam", true],
          ["Automatic", "Yesterday · Alex", false]
        ].map(([name, meta, selected]) => (
          <div
            class={clsx(
              "flex items-center gap-2 rounded-lg px-1.5 py-1",
              selected && "bg-gray-100"
            )}
          >
            <span
              class={clsx(
                "h-4 w-4 shrink-0 text-gray-400",
                selected ? "i-lucide:bookmark" : "i-lucide:history"
              )}
            />
            <span class="flex min-w-0 flex-col leading-tight">
              <span class="text-gray-700">{name}</span>
              <span class="text-gray-400">{meta}</span>
            </span>
            {selected && (
              <span
                class={clsx(
                  styles.pop,
                  "ml-auto flex items-center gap-1 rounded-md bg-gradient-to-tr px-1.5 py-0.5 text-white"
                )}
              >
                <span class="i-lucide:radio h-3 w-3" />
                Published
              </span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  </Stage>
);

const TransformerGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-6 bottom-0 top-4 rounded-b-none text-xs">
      <div class="flex gap-3 border-b border-gray-200 px-3 pt-2 text-gray-500">
        <span class="relative pb-1.5">
          Editor
          <span
            class={clsx(styles.fadeOut, "absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-tr")}
          />
        </span>
        <span class="relative pb-1.5 font-medium text-gray-700">
          MDX
          <span
            class={clsx(styles.fadeIn, "absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-tr")}
          />
        </span>
        <span class="pb-1.5">HTML</span>
      </div>
      <div class="relative h-24 p-3">
        <div
          class={clsx(
            styles.fadeOut,
            "absolute inset-3 flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-gray-600"
          )}
        >
          <span class="i-lucide:lightbulb h-4 w-4 shrink-0 text-tertiary" />
          Press ⌘K to search the workspace.
        </div>
        <div class={clsx(styles.fadeIn, "font-mono leading-relaxed text-gray-500")}>
          <div>
            {"<"}
            <span class={clsx(gradientText, "font-semibold")}>Callout</span> type="tip"{">"}
          </div>
          <div class="pl-3 text-gray-700">Press ⌘K to search the workspace.</div>
          <div>
            {"</"}
            <span class={clsx(gradientText, "font-semibold")}>Callout</span>
            {">"}
          </div>
        </div>
      </div>
    </Panel>
  </Stage>
);

const GitHubSyncGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-6 top-4 flex items-center gap-2 px-3 py-2 text-xs">
      <span class="i-lucide:git-commit-horizontal h-4 w-4 shrink-0 text-gray-400" />
      <span class="flex min-w-0 flex-col leading-tight">
        <span class="font-medium text-gray-700">Publish 3 entries</span>
        <span class="truncate font-mono text-gray-400">Andesine-Sync: pub_8f2c</span>
      </span>
      <span class="ml-auto text-gray-400">now</span>
    </Panel>
    <Panel
      late
      class="absolute inset-x-6 bottom-0 top-[4.75rem] rounded-b-none p-2 font-mono text-xs"
    >
      <div class="flex items-center gap-1.5 px-1 text-gray-500">
        <span class="i-lucide:folder h-3.5 w-3.5" />
        src/content/docs
      </div>
      {[
        ["meta.json", "M", "text-amber-500"],
        ["quickstart.mdx", "M", "text-amber-500"],
        ["publishing.mdx", "+", "text-green-500"]
      ].map(([name, status, color]) => (
        <div class="flex items-center gap-1.5 py-0.5 pl-6 pr-1 text-gray-700">
          <span class="i-lucide:file h-3.5 w-3.5 text-gray-400" />
          {name}
          <span class={clsx(styles.pop, "ml-auto font-semibold", color)}>{status}</span>
        </div>
      ))}
    </Panel>
  </Stage>
);

const CollaborationGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-6 bottom-0 top-4 rounded-b-none px-4 pt-3 text-xs">
      <div class="text-sm font-semibold text-gray-700">Quickstart</div>
      <p class="mt-2 leading-loose text-gray-500">
        Create a workspace, then{" "}
        <span class="relative rounded-sm bg-gray-200/70 text-gray-700">
          invite your team
          <span class="absolute -top-4 left-0 rounded-md bg-gray-500 px-1 text-[0.625rem] leading-4 text-white">
            Sam
          </span>
        </span>{" "}
        and write <span class={clsx(styles.type, "inline-block")}>together.</span>
        <span
          class={clsx(
            styles.caret,
            "relative inline-block h-3.5 w-0.5 align-middle bg-gradient-to-tr"
          )}
        >
          <span class="absolute -top-4 left-0 rounded-md bg-gradient-to-tr px-1 text-[0.625rem] leading-4 text-white">
            Alex
          </span>
        </span>
      </p>
      <p class="leading-loose text-gray-500">Changes sync live for every editor.</p>
    </Panel>
  </Stage>
);

const AccessGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-6 bottom-0 top-4 rounded-b-none text-xs">
      <div class="flex items-center gap-1.5 border-b border-gray-200 px-3 py-2 font-semibold text-gray-700">
        <span class="i-lucide:lock h-3.5 w-3.5 text-tertiary" />
        Member access
      </div>
      <div class="flex flex-col gap-1 p-2 text-gray-700">
        {[
          ["AK", "Alex Kim", "Viewer", "Editor"],
          ["SL", "Sam Lee", "Viewer", "Viewer"]
        ].map(([initials, name, from, to]) => (
          <div class="flex items-center gap-2 px-1">
            <span class="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[0.625rem] text-gray-500">
              {initials}
            </span>
            {name}
            <span class="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 px-1.5 py-0.5 text-gray-500">
              <Swap from={from} to={to} />
              <span class="i-lucide:chevron-down h-3 w-3" />
            </span>
          </div>
        ))}
      </div>
    </Panel>
    <Menu
      class="right-8 top-[4.25rem] w-28"
      items={["Admin", "Developer", "Editor", "Viewer"]}
      selected="Editor"
    />
  </Stage>
);

const AgentGraphic: Component = () => (
  <Stage>
    <Panel class="absolute bottom-4 left-4 top-4 flex w-[58%] flex-col gap-2 p-3 text-xs text-gray-500">
      <span class="text-sm font-semibold text-gray-700">Connect Claude</span>
      <span class="flex items-center justify-between rounded-lg border border-gray-200 px-2 py-1 text-gray-700">
        Acme Docs
        <span class="i-lucide:chevron-down h-3 w-3 text-gray-400" />
      </span>
      <span class="flex items-center gap-1.5">
        <span class="flex h-3.5 w-3.5 items-center justify-center rounded border border-gray-300">
          <span class={clsx(styles.pop, "i-lucide:check h-3 w-3 text-tertiary")} />
        </span>
        Enable write access
      </span>
      <span class="mt-auto self-end rounded-lg bg-gradient-to-tr px-2 py-1 font-medium text-white">
        Approve
      </span>
    </Panel>
    <Panel late class="absolute bottom-8 right-4 w-[40%] p-2 text-xs text-gray-500">
      <span class="flex items-center gap-1 font-mono text-gray-700">
        <span class="i-lucide:wrench h-3 w-3 text-tertiary" />
        edit_entry
      </span>
      <p class={clsx(styles.fadeIn, "mt-1 leading-snug")}>Updated the Quickstart guide.</p>
    </Panel>
  </Stage>
);

// Editor for everyone: the app's format toolbar over a selection, and its publish menu.
const DocsEditorGraphic: Component = () => (
  <Stage>
    <Panel class="absolute bottom-0 left-4 top-4 w-[66%] rounded-b-none px-4 pt-11 text-xs">
      <div class="text-sm font-semibold text-gray-700">Quickstart</div>
      <p class="mt-1.5 leading-relaxed text-gray-500">
        Create a workspace and{" "}
        <span class="rounded-sm bg-tertiary/15 font-semibold text-gray-700">invite your team</span>.
      </p>
    </Panel>
    <Panel late class="absolute left-8 top-6 flex items-center gap-1 p-1">
      <span class="pointer-events-none absolute bottom-1 left-1 top-1 w-6 rounded-lg bg-gradient-to-tr opacity-10" />
      {[
        "i-lucide:bold",
        "i-lucide:italic",
        "i-lucide:strikethrough",
        "i-lucide:code",
        "i-lucide:link-2"
      ].map((icon, index) => (
        <span class="flex h-6 w-6 items-center justify-center rounded-lg">
          <span
            class={clsx(icon, "h-4 w-4", index === 0 ? "bg-gradient-to-tr" : "text-gray-700")}
          />
        </span>
      ))}
    </Panel>
    <Panel late class="absolute bottom-4 right-4 flex w-40 flex-col gap-0.5 p-1 text-xs">
      <span class="px-1 py-0.5 text-gray-500">Publish to</span>
      {[
        ["i-lucide:globe", "Docs site"],
        ["i-mdi:github", "GitHub"],
        ["i-lucide:app-window", "Your site"]
      ].map(([icon, label]) => (
        <span class="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-gray-700">
          <span class={clsx(icon, "h-4 w-4 text-gray-500")} />
          {label}
          <span
            class={clsx(
              styles.pop,
              "i-material-symbols:check-circle-outline-rounded ml-auto h-4 w-4 text-green-500"
            )}
          />
        </span>
      ))}
    </Panel>
  </Stage>
);

const contentProperties = [
  ["i-lucide:circle-chevron-down", "Status", "Ready"],
  ["i-lucide:calendar", "Release date", "Nov 9, 2026"]
];

// Content and data side by side: the app's property rows, tags, and a checkbox, from a schema.
const StructuredContentGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 rounded-b-none px-4 pt-3 text-xs">
      <div class="flex items-center gap-1.5 text-gray-400">
        <span class="i-tabler:pyramid h-3.5 w-3.5" />
        Changelog
      </div>
      <div class="mt-1 text-sm font-semibold text-gray-700">Version 2.0</div>
      <div class="mt-2 flex flex-col gap-1.5">
        {contentProperties.map(([icon, name, value]) => (
          <div class="flex items-center">
            <span class="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
              <span class={clsx(icon, "h-4 w-4 text-gray-300")} />
              {name}
            </span>
            <span class="text-gray-700">{value}</span>
          </div>
        ))}
        <div class="flex items-center">
          <span class="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
            <span class="i-lucide:list-collapse h-4 w-4 text-gray-300" />
            Tags
          </span>
          <span class="flex gap-1">
            {["Search", "AI"].map((tag) => (
              <span class="rounded-md bg-white px-1.5 py-px font-medium text-gray-500 outline outline-1 outline-gray-200 shadow-sm">
                {tag}
              </span>
            ))}
          </span>
        </div>
        <div class="flex items-center">
          <span class="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
            <span class="i-lucide:toggle-right h-4 w-4 text-gray-300" />
            Featured
          </span>
          <span
            class={clsx(
              styles.pop,
              "flex h-4 w-4 items-center justify-center rounded bg-gradient-to-tr shadow-md shadow-tertiary/25"
            )}
          >
            <span class="i-lucide:check h-3 w-3 text-white" />
          </span>
        </div>
      </div>
    </Panel>
  </Stage>
);

// You decide who sees what: the app's role permissions and a restricted collection's group access.
const AccessControlGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 top-4 px-3 py-2 text-xs">
      <div class="flex items-center gap-2 text-gray-400">
        Permissions
        <span class="h-px flex-1 bg-gray-200" />
      </div>
      {[
        ["Content", "Manage", "Manage"],
        ["Restricted collections", "None", "View"]
      ].map(([name, from, to]) => (
        <div class="mt-1.5 flex items-center justify-between gap-2">
          <span class="font-medium text-gray-700">{name}</span>
          <span class="isolate flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 text-gray-400">
            {["None", "View", "Manage"].map((option) => (
              <span
                class={clsx(
                  "relative rounded-md px-1.5 py-px font-medium",
                  option === to && "text-gray-700"
                )}
              >
                {option}
                {option === to && (
                  <span
                    class={clsx(
                      from !== to && styles.fadeIn,
                      "absolute inset-0 -z-1 rounded-md bg-white outline outline-1 outline-gray-200 shadow-sm"
                    )}
                  />
                )}
              </span>
            ))}
          </span>
        </div>
      ))}
    </Panel>
    <Panel late class="absolute bottom-4 left-4 right-10 p-1.5 text-xs">
      <div class="flex items-center gap-1.5 px-1 font-medium text-gray-700">
        <span class="i-lucide:lock h-3.5 w-3.5 text-tertiary" />
        Finance
        <span class="font-normal text-gray-400">· Restricted</span>
      </div>
      <div class="mt-1 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gray-500/10 to-transparent px-1 py-0.5 font-medium text-gray-700">
        <span class="i-lucide:users h-4 w-4 text-gray-400" />
        Support
        <span class="h-3.5 w-px bg-gray-200" />
        <span class="font-normal text-gray-400">4 members</span>
        <span class={clsx(styles.pop, "ml-auto font-normal text-gray-400")}>Viewer</span>
      </div>
    </Panel>
  </Stage>
);

// Your agents already know: an AI answer with sources, and an MCP client connected to the workspace.
const HubGraphic: Component = () => (
  <Stage>
    <Panel class="absolute inset-x-4 bottom-0 top-4 flex flex-col gap-1.5 rounded-b-none p-3 text-xs">
      <p class="self-end rounded-lg bg-gray-100 px-2 py-1 text-gray-700">
        How do I rotate an API key?
      </p>
      <p class={clsx(styles.fadeIn, "max-w-9/10 leading-snug text-gray-500")}>
        Open the key's menu in Settings and select Rotate.{" "}
        <span class="font-mono text-gray-400">[1]</span>
      </p>
      <div
        class={clsx(
          styles.fadeIn,
          "flex items-start gap-1 rounded-lg bg-gradient-to-r from-gray-500/10 to-transparent py-1 pl-0.5 pr-1"
        )}
      >
        <span class="i-lucide:file-text h-4 w-4 shrink-0 text-gray-400" />
        <span class="flex min-w-0 flex-1 flex-col leading-tight">
          <span class="font-medium text-gray-700">API keys</span>
          <span class="text-gray-400">Docs › Settings</span>
        </span>
        <span class="font-mono text-gray-400">[1]</span>
      </div>
    </Panel>
    <Panel
      late
      class="absolute bottom-4 right-4 flex w-48 items-center gap-1.5 px-2 py-1.5 text-xs"
    >
      <span class="i-lucide:plug h-4 w-4 text-gray-400" />
      <span class="font-medium text-gray-700">Claude Code</span>
      <span class="h-3.5 w-px bg-gray-200" />
      <span class={clsx(styles.pop, "text-gray-400")}>Used now</span>
    </Panel>
  </Stage>
);

export {
  Stage,
  Panel,
  CollaborationGraphic,
  HistoryGraphic,
  ContentAPIGraphic,
  PublishingGraphic,
  TransformerGraphic,
  HostedSiteGraphic,
  GitHubSyncGraphic,
  AccessGraphic,
  AgentGraphic,
  DocsEditorGraphic,
  StructuredContentGraphic,
  AccessControlGraphic,
  HubGraphic
};
