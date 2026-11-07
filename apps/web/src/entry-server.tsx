/* @refresh reload */
import { generateHydrationScript, renderToStream, ssr } from "solid-js/web";
import { provideRequestEvent } from "solid-js/web/storage";
import App from "./app";

interface RenderResponse {
  status?: number;
  headers: Headers;
}

type Render = (request: Request, template: string) => Promise<Response>;
type RenderToStreamOptions = NonNullable<Parameters<typeof renderToStream>[1]> & {
  onError(error: unknown): void;
};

const SSR_OUTLET = "<!--ssr-outlet-->";

const isRedirectResponse = (response: RenderResponse): boolean => {
  const status = response.status ?? 200;

  return status >= 300 && status < 400 && response.headers.has("location");
};
/** Renders a page with Web streams. */
const render: Render = async (request, template) => {
  const url = new URL(request.url);
  // The router changes it or sets its own on redirects, so it's read from the event at the end.
  const event: { request: Request; response: RenderResponse } = {
    request,
    response: { headers: new Headers() }
  };
  const [templateStart, templateEnd] = template
    .replace("<!--app-head-->", generateHydrationScript())
    .split(SSR_OUTLET);

  if (templateEnd === undefined) {
    throw new Error("SSR template must include a <!--ssr-outlet--> placeholder");
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

  let resolveShellReady: (() => void) | undefined;
  let rejectShellReady: ((reason?: unknown) => void) | undefined;
  let shellReadySettled = false;

  const shellReady = new Promise<void>((resolve, reject) => {
    resolveShellReady = resolve;
    rejectShellReady = reject;
  });
  const settleShell = () => {
    shellReadySettled = true;
    resolveShellReady?.();
  };
  const renderOptions: RenderToStreamOptions = {
    onCompleteShell: settleShell,
    onCompleteAll: settleShell,
    onError(error) {
      if (shellReadySettled) return;

      shellReadySettled = true;
      rejectShellReady?.(error);
    }
  };
  const appStream = provideRequestEvent(event, () => {
    return renderToStream(
      () => ssr([templateStart, templateEnd], <App url={`${url.pathname}${url.search}`} />),
      renderOptions
    );
  });

  // A failed render rejects the shell; the error is reported there.
  void Promise.resolve(appStream.pipeTo(writable)).catch(() => undefined);

  try {
    await shellReady;
  } catch (error) {
    void readable.cancel().catch(() => undefined);
    throw error instanceof Error ? error : new Error(String(error));
  }

  const { response } = event;

  if (isRedirectResponse(response)) {
    void readable.cancel().catch(() => undefined);

    return new Response(null, { status: response.status, headers: response.headers });
  }

  // Copied whole, so several Set-Cookie headers stay separate.
  const headers = new Headers(response.headers);

  if (!headers.has("content-type")) headers.set("Content-Type", "text/html");

  return new Response(readable, { status: response.status ?? 200, headers });
};

export { render };
export type { Render };
