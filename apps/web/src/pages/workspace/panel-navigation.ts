interface WorkspacePanelSearchParams {
  lp?: unknown;
  rp?: unknown;
}

type WorkspacePanelParam = "lp" | "rp";

const LEFT_SIDE_PANEL_PARAM: WorkspacePanelParam = "lp";
const RIGHT_SIDE_PANEL_PARAM: WorkspacePanelParam = "rp";
const WORKSPACE_PANEL_PARAMS: WorkspacePanelParam[] = [
  LEFT_SIDE_PANEL_PARAM,
  RIGHT_SIDE_PANEL_PARAM
];

const withWorkspacePanelParams = (
  path: string,
  currentSearchParams: WorkspacePanelSearchParams
) => {
  const [pathname, query = ""] = path.split("?");
  const searchParams = new URLSearchParams(query);

  for (const param of WORKSPACE_PANEL_PARAMS) {
    const value = currentSearchParams[param];

    if (typeof value === "string") searchParams.set(param, value);
  }

  const nextQuery = searchParams.toString();

  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}`;
};

export { LEFT_SIDE_PANEL_PARAM, RIGHT_SIDE_PANEL_PARAM, withWorkspacePanelParams };
