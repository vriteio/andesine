import {
  type Params,
  type SearchParams,
  redirect,
  type RouteDefinition,
  useCurrentMatches,
  useLocation,
  useParams
} from "@solidjs/router";
import { type Accessor, createMemo, lazy } from "solid-js";
import { type ExtensionIconSource } from "#web/components/extensions/extension-icon";
import { useRouteExtension } from "./route-extension";

import CollectionPage from "../../pages/workspace/collection/page";
import SettingsLayout from "../../pages/workspace/settings/layout";
import PersonalSettingsPage from "../../pages/workspace/settings/personal/page";
import WorkspaceSettingsPage from "../../pages/workspace/settings/workspace/page";
import PublishingSettingsPage from "../../pages/workspace/settings/publishing/page";
import PeopleSettingsPage from "../../pages/workspace/settings/people/page";
import InviteSettingsPage from "../../pages/workspace/settings/invite/page";
import RoleSettingsPage from "../../pages/workspace/settings/role/page";
import GroupSettingsPage from "../../pages/workspace/settings/group/page";
import BillingSettingsPage from "../../pages/workspace/settings/billing/page";
import APISettingsPage from "../../pages/workspace/settings/api/page";
import KeySettingsPage from "../../pages/workspace/settings/key/page";
import WebhookSettingsPage from "../../pages/workspace/settings/webhook/page";
import WebhookEventsPage from "../../pages/workspace/settings/webhook-events/page";
import ExtensionsSettingsPage from "../../pages/workspace/settings/extensions/page";
import ExtensionPage from "../../pages/workspace/settings/extension/page";
import ExtensionSettingsPage from "../../pages/workspace/settings/extension-settings/page";
import ExtensionInstallPage from "../../pages/workspace/settings/extension-install/page";
import ExtensionWebhookEventsPage from "../../pages/workspace/settings/extension-webhook-events/page";

const AuthLayout = lazy(() => import("../../pages/auth/layout"));
const DevicePage = lazy(() => import("../../pages/auth/device/page"));
const EmailPage = lazy(() => import("../../pages/auth/email/page"));
const SignInPage = lazy(() => import("../../pages/auth/sign-in/page"));
const SignUpPage = lazy(() => import("../../pages/auth/sign-up/page"));
const InvitePage = lazy(() => import("../../pages/invite/page"));
const NewWorkspacePage = lazy(() => import("../../pages/new-workspace/page"));
const WorkspaceLayout = lazy(() => import("../../pages/workspace/layout"));
const EntryPage = lazy(() => import("../../pages/workspace/entry/page"));
const SchemaPage = lazy(() => import("../../pages/workspace/schema/page"));

interface RouteData {
  title: string;
  /** Shown at the top-left of the settings header. */
  extensionIcon?: ExtensionIconSource;
  /** Data the page names, e.g. its extension, loads in the browser; a spinner shows meanwhile. */
  loading?: boolean;
  breadcrumbs: Array<{
    label: string;
    path?: string;
  }>;
}
/** Loaded data that route titles and breadcrumbs name. */
interface RouteContext {
  extension: (ExtensionIconSource & { displayName: string }) | null;
}

const routesData: Record<
  string,
  (params: Params, query: SearchParams, context: RouteContext) => RouteData
> = {
  "/:workspaceID/settings/personal": () => ({
    title: "Personal",
    breadcrumbs: [{ label: "Settings" }, { label: "Personal", path: "/settings/personal" }]
  }),
  "/:workspaceID/settings/workspace": () => ({
    title: "General",
    breadcrumbs: [{ label: "Settings" }, { label: "General", path: "/settings/workspace" }]
  }),
  "/:workspaceID/settings/publishing": () => ({
    title: "Publishing",
    breadcrumbs: [{ label: "Settings" }, { label: "Publishing", path: "/settings/publishing" }]
  }),
  "/:workspaceID/settings/people": () => ({
    title: "People",
    breadcrumbs: [{ label: "Settings" }, { label: "People", path: "/settings/people" }]
  }),
  "/:workspaceID/settings/invite": () => ({
    title: "Invite member",
    breadcrumbs: [
      { label: "Settings" },
      { label: "People", path: "/settings/people" },
      { label: "Invite", path: "/settings/invite" }
    ]
  }),
  "/:workspaceID/settings/role/:roleID?": (params) => ({
    title: params.roleID ? "Edit role" : "Create role",
    breadcrumbs: [
      { label: "Settings" },
      { label: "People", path: "/settings/people" },
      {
        label: params.roleID ? "Edit role" : "Create role",
        path: `/settings/role/${params.roleID || ""}`
      }
    ]
  }),
  "/:workspaceID/settings/group/:groupID?": (params) => ({
    title: params.groupID ? "Edit group" : "Create group",
    breadcrumbs: [
      { label: "Settings" },
      { label: "People", path: "/settings/people" },
      {
        label: params.groupID ? "Edit group" : "Create group",
        path: `/settings/group/${params.groupID || ""}`
      }
    ]
  }),
  "/:workspaceID/settings/billing": () => ({
    title: "Billing",
    breadcrumbs: [{ label: "Settings" }, { label: "Billing", path: "/settings/billing" }]
  }),
  "/:workspaceID/settings/api": () => ({
    title: "API",
    breadcrumbs: [{ label: "Settings" }, { label: "API", path: "/settings/api" }]
  }),
  "/:workspaceID/settings/key/:keyID?": (params, query) => {
    const kind = query.kind === "publishable" ? "publishable" : "secret";
    const label = `${params.keyID ? "Edit" : "Create"} ${kind} key`;

    return {
      title: label,
      breadcrumbs: [
        { label: "Settings" },
        { label: "API", path: "/settings/api" },
        { label, path: `/settings/key/${params.keyID || ""}?kind=${kind}` }
      ]
    };
  },
  "/:workspaceID/settings/webhook/:webhookID?": (params) => ({
    title: params.webhookID ? "Edit webhook" : "Create webhook",
    breadcrumbs: [
      { label: "Settings" },
      { label: "API", path: "/settings/api" },
      {
        label: params.webhookID ? "Edit webhook" : "Create webhook",
        path: `/settings/webhook/${params.webhookID || ""}`
      }
    ]
  }),
  "/:workspaceID/settings/extensions": () => ({
    title: "Extensions",
    breadcrumbs: [{ label: "Settings" }, { label: "Extensions", path: "/settings/extensions" }]
  }),
  "/:workspaceID/settings/extension/:extensionID": (params, _query, { extension }) => ({
    title: extension?.displayName ?? "Extension",
    extensionIcon: extension ?? undefined,
    loading: !extension,
    breadcrumbs: [
      { label: "Settings" },
      { label: "Extensions", path: "/settings/extensions" },
      {
        label: extension?.displayName ?? "Extension",
        path: `/settings/extension/${params.extensionID}`
      }
    ]
  }),
  "/:workspaceID/settings/extension/:extensionID/settings": (params, _query, { extension }) => ({
    title: extension ? `${extension.displayName} settings` : "Extension settings",
    extensionIcon: extension ?? undefined,
    loading: !extension,
    breadcrumbs: [
      { label: "Settings" },
      { label: "Extensions", path: "/settings/extensions" },
      {
        label: extension?.displayName ?? "Extension",
        path: `/settings/extension/${params.extensionID}`
      },
      { label: "Settings", path: `/settings/extension/${params.extensionID}/settings` }
    ]
  }),
  "/:workspaceID/settings/extension/:extensionID/webhook/:webhookID/events": (
    params,
    _query,
    { extension }
  ) => ({
    title: "Webhook events",
    breadcrumbs: [
      { label: "Settings" },
      { label: "Extensions", path: "/settings/extensions" },
      {
        label: extension?.displayName ?? "Extension",
        path: `/settings/extension/${params.extensionID}`
      },
      {
        label: "Webhook events",
        path: `/settings/extension/${params.extensionID}/webhook/${params.webhookID}/events`
      }
    ]
  }),
  "/:workspaceID/settings/extension-install/:scope/:name": (params) => ({
    title: "Install extension",
    breadcrumbs: [
      { label: "Settings" },
      { label: "Extensions", path: "/settings/extensions" },
      {
        label: "Install extension",
        path: `/settings/extension-install/${params.scope}/${params.name}`
      }
    ]
  }),
  "/:workspaceID/settings/webhook/:webhookID/events": (params) => ({
    title: "Webhook events",
    breadcrumbs: [
      { label: "Settings" },
      { label: "API", path: "/settings/api" },
      { label: "Webhook events", path: `/settings/webhook/${params.webhookID}/events` }
    ]
  })
};
const routes: RouteDefinition[] = [
  {
    path: "/auth",
    component: AuthLayout,
    children: [
      { path: "/sign-in", component: SignInPage },
      { path: "/sign-up", component: SignUpPage },
      { path: "/email", component: EmailPage },
      { path: "/device", component: DevicePage }
    ]
  },
  { path: "/invite", component: InvitePage },
  { path: "/new-workspace", component: NewWorkspacePage },
  {
    path: "/:workspaceID",
    component: WorkspaceLayout,
    children: [
      {
        path: "/settings",
        component: SettingsLayout,
        children: [
          {
            path: "/",
            preload: ({ params }) => {
              throw redirect(`/${params.workspaceID}/settings/personal`);
            }
          },
          {
            path: "/personal",
            component: PersonalSettingsPage
          },
          {
            path: "/workspace",
            component: WorkspaceSettingsPage
          },
          {
            path: "/publishing",
            component: PublishingSettingsPage
          },
          {
            path: "/people",
            component: PeopleSettingsPage
          },
          {
            path: "/invite",
            component: InviteSettingsPage
          },
          {
            path: "/role/:roleID?",
            component: RoleSettingsPage
          },
          {
            path: "/group/:groupID?",
            component: GroupSettingsPage
          },
          {
            path: "/billing",
            component: BillingSettingsPage
          },
          {
            path: "/api",
            component: APISettingsPage
          },
          {
            path: "/key/:keyID?",
            component: KeySettingsPage
          },
          {
            path: "/extensions",
            component: ExtensionsSettingsPage
          },
          {
            path: "/extension/:extensionID/webhook/:webhookID/events",
            component: ExtensionWebhookEventsPage
          },
          {
            path: "/extension/:extensionID/settings",
            component: ExtensionSettingsPage
          },
          {
            path: "/extension/:extensionID",
            component: ExtensionPage
          },
          {
            path: "/extension-install/:scope/:name",
            component: ExtensionInstallPage
          },
          {
            path: "/webhook/:webhookID/events",
            component: WebhookEventsPage
          },
          {
            path: "/webhook/:webhookID?",
            component: WebhookSettingsPage
          }
        ]
      },
      { path: "/", component: EntryPage },
      {
        path: "/:slug",
        matchFilters: { slug: /^ent_/ },
        component: EntryPage
      },
      {
        path: "/:slug",
        matchFilters: { slug: /^coll_/ },
        component: CollectionPage
      },
      {
        path: "/:slug",
        matchFilters: { slug: /^sch_/ },
        component: SchemaPage
      }
    ]
  }
];

/** Data such as an extension's name fills in after hydration. */
const useRouteData = (): Accessor<RouteData | null> => {
  const params = useParams();
  const location = useLocation();
  const currentMatches = useCurrentMatches();
  const extension = useRouteExtension();
  const routeData = createMemo(() => {
    const matches = currentMatches();
    const context: RouteContext = { extension: extension() };

    for (const match of matches) {
      const routeData = routesData[match.route.pattern];

      if (routeData) {
        return routeData(params, location.query, context);
      }
    }

    const segments = location.pathname.split("/").filter(Boolean);
    const settingsIndex = segments.indexOf("settings");
    const settingsRoute = segments[settingsIndex + 1];
    const optionalRoutePatterns: Record<string, string> = {
      group: "/:workspaceID/settings/group/:groupID?",
      key: "/:workspaceID/settings/key/:keyID?",
      role: "/:workspaceID/settings/role/:roleID?",
      webhook: "/:workspaceID/settings/webhook/:webhookID?"
    };
    const optionalRouteData = settingsRoute
      ? routesData[optionalRoutePatterns[settingsRoute]]
      : null;

    if (optionalRouteData) return optionalRouteData(params, location.query, context);

    return null;
  });

  return routeData;
};

export { routes, useRouteData };
