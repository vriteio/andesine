import { type Component, onMount, Show, Suspense } from "solid-js";
import { type RouteSectionProps, useLocation } from "@solidjs/router";
import { NoHydration } from "solid-js/web";
import { Logo, Skeleton, AnimatedGradientCard, DotsBackground } from "@andesine/components";
import { lockOfflineState } from "#web/lib/offline";

const tips = [
  "You're one invite away from collaborating with your team in real-time across your entire workspace.",
  "You can use a Passkey to sign in with one click, no password or email code required.",
  "You can work with multiple teams across different workspaces and accounts, easily switching between them.",
  "You can structure your content the way you like with nested collections and some drag and drop."
];

const AuthLayout: Component<RouteSectionProps> = (props) => {
  const location = useLocation();
  const isDeviceRoute = () => location.pathname.replace(/\/$/, "") === "/auth/device";

  onMount(() => {
    if (
      !isDeviceRoute() &&
      new URLSearchParams(window.location.search).get("addAccount") !== "true"
    ) {
      lockOfflineState();
    }
  });

  return (
    <div class="flex flex-row h-full w-full">
      <DotsBackground class="absolute mask-edge-fading-16" />
      <Logo class="top-4 left-4 absolute" />
      <div class="flex-1 relative flex overflow-y-auto">
        <div class="p-4 lg:p-24 relative m-auto">
          <div class="absolute h-full w-full top-0 left-0 mask-edge-fading-4 lg:mask-edge-fading-24 bg-gray-100 rounded-2xl" />
          <div class="relative flex flex-col w-80 max-w-full">
            <Suspense
              fallback={
                <Show when={!isDeviceRoute()}>
                  <div class="flex flex-col w-full">
                    <Skeleton
                      class={[
                        "my-1 h-6 w-2/5",
                        "h-8 my-1 w-3/5",
                        "my-4 h-8 w-full",
                        "mt-1 h-8 w-2/5"
                      ]}
                    />
                  </div>
                </Show>
              }
            >
              {props.children}
            </Suspense>
          </div>
        </div>
      </div>
      <div class="hidden lg:block flex-1 p-3 max-w-5/12">
        <AnimatedGradientCard class="h-full w-full rounded-2xl">
          <div class="flex flex-col items-center text-center max-w-xl relative p-4">
            <div class="rounded-md font-medium px-1.5 bg-gray-100 bg-opacity-30 backdrop-blur-md border-white absolute -top-8">
              Did you know?
            </div>
            <div class="relative w-full">
              <div class="text-2xl">
                <NoHydration>{tips[Math.floor(Math.random() * tips.length)]}</NoHydration>
              </div>
            </div>
          </div>
        </AnimatedGradientCard>
      </div>
    </div>
  );
};

export default AuthLayout;
