import { useLocation, useParams, useSearchParams } from "@solidjs/router";
import { type Accessor, type Component, Match, Switch } from "solid-js";
import { ExtensionPanelView } from "#web/components/extensions/panel-view";
import { getExtensionPanels } from "#web/lib/extensions";

import { ExplorerPanel } from "./explorer";
import { HelpPanel } from "./help";
import { SettingsMenu } from "./settings-menu";
import { LEFT_SIDE_PANEL_PARAM } from "../panel-navigation";

interface SidePanelProps {
  selectedPanel?: PrimaryPanel;
}

/** Extension panels are `ext:<extensionID>:<panelID>`. */
type PrimaryPanel = "explorer" | "help" | "settings" | `ext:${string}`;

const EXTENSION_PANEL_PREFIX = "ext:";

const findLeftExtensionPanel = (panel: string) => {
  return getExtensionPanels("left").find(({ id }) => id === panel);
};

const usePrimaryPanel = (): Accessor<PrimaryPanel> => {
  const location = useLocation();
  const params = useParams<{ workspaceID?: string }>();
  const [searchParams] = useSearchParams();
  const settingsPath = () => `/${params.workspaceID || ""}/settings`;

  return () => {
    const requested = searchParams[LEFT_SIDE_PANEL_PARAM];

    if (requested === "help") {
      return "help";
    }

    if (typeof requested === "string" && findLeftExtensionPanel(requested)) {
      return requested as PrimaryPanel;
    }

    if (
      location.pathname === settingsPath() ||
      location.pathname.startsWith(`${settingsPath()}/`)
    ) {
      return "settings";
    }

    return "explorer";
  };
};

const SidePanel: Component<SidePanelProps> = (props) => {
  const routePanel = usePrimaryPanel();
  const panel = () => props.selectedPanel || routePanel();

  return (
    <Switch>
      <Match when={panel() === "settings"}>
        <SettingsMenu />
      </Match>
      <Match when={panel() === "help"}>
        <HelpPanel />
      </Match>
      <Match
        when={panel().startsWith(EXTENSION_PANEL_PREFIX) && findLeftExtensionPanel(panel())}
        keyed
      >
        {(item) => <ExtensionPanelView item={item} context={{}} />}
      </Match>
      <Match when={panel() === "explorer"}>
        <ExplorerPanel />
      </Match>
    </Switch>
  );
};

export { SidePanel, usePrimaryPanel, findLeftExtensionPanel };
export type { PrimaryPanel };
