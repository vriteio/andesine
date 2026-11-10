import { config } from "#web/lib/api";
import { authClient } from "#web/lib/api";
import { validateWorkspaceID } from "#web/lib/validation";

const normalizeRedirectTo = (value?: string | null): string | null => {
  const redirectTo = value?.trim();

  if (!redirectTo?.startsWith("/")) return null;

  const appOrigin = new URL(config.PUBLIC_APP_URL).origin;

  // Backslashes and dot segments can resolve to another origin or to "//host".
  try {
    const url = new URL(redirectTo, appOrigin);
    const path = `${url.pathname}${url.search}${url.hash}`;
    const isSameOrigin = url.origin === appOrigin && !path.startsWith("//");

    return isSameOrigin ? path : null;
  } catch {
    return null;
  }
};

const appendRedirectTo = (path: string, redirectTo?: string | null, addAccount = false) => {
  const normalizedRedirectTo = normalizeRedirectTo(redirectTo);

  if (!normalizedRedirectTo && !addAccount) return path;

  const url = new URL(path, config.PUBLIC_APP_URL);

  if (normalizedRedirectTo) url.searchParams.set("redirectTo", normalizedRedirectTo);
  if (addAccount) url.searchParams.set("addAccount", "true");

  return `${url.pathname}${url.search}`;
};

const toCallbackURL = (redirectTo?: string | null) => {
  return `${config.PUBLIC_APP_URL}${normalizeRedirectTo(redirectTo) || ""}`;
};

const getPostAuthRedirectPath = async (redirectTo?: string | null) => {
  const normalizedRedirectTo = normalizeRedirectTo(redirectTo);

  if (normalizedRedirectTo) return normalizedRedirectTo;

  const { data } = await authClient.getSession();
  const currentWorkspaceID = data?.user.currentWorkspaceID;

  if (!data?.session) return "/auth/sign-in";
  if (currentWorkspaceID && validateWorkspaceID(currentWorkspaceID))
    return `/${currentWorkspaceID}/`;

  return "/new-workspace";
};

const redirectAfterAuth = async (redirectTo?: string | null) => {
  window.location.assign(await getPostAuthRedirectPath(redirectTo));
};

export {
  appendRedirectTo,
  getPostAuthRedirectPath,
  normalizeRedirectTo,
  redirectAfterAuth,
  toCallbackURL
};
