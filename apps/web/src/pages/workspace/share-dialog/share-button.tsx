import { IconButton, Tooltip } from "@andesine/components";
import { createAsync } from "@solidjs/router";
import { type Component, createSignal, Show, Suspense } from "solid-js";
import { useNotify } from "#web/context/notifications";
import { sharesQuery, sharingPolicyQuery } from "#web/lib/data";
import { ShareDialog } from "./share-dialog";

interface ShareButtonProps {
  entryID: string;
  entryName: string;
}

const ShareButton: Component<ShareButtonProps> = (props) => {
  const notify = useNotify();
  const [opened, setOpened] = createSignal(false);
  // Mounted from the first open, so it isn't rendered before it's needed.
  const [mounted, setMounted] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  // For the badge; a failed load shows none, and the open reports it.
  const shares = createAsync(() => sharesQuery(props.entryID).catch(() => []));
  const hasLink = () => shares()?.some(({ kind }) => kind === "link") ?? false;
  const emailCount = () => shares()?.filter(({ kind }) => kind === "email").length ?? 0;
  const open = async () => {
    setLoading(true);

    try {
      await Promise.all([sharesQuery(props.entryID), sharingPolicyQuery()]);
      setMounted(true);
      setOpened(true);
    } catch (error) {
      console.error(error);
      notify({ type: "error", text: "Failed to load sharing" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip content="Share" placement="bottom" fixed>
        <div class="relative">
          <IconButton
            icon="i-tabler:world-share"
            variant="ghost"
            aria-label="Share"
            loading={loading()}
            onClick={open}
          />
          {/* Its own boundary, so loading the shares doesn't suspend the toolbar. */}
          <Suspense>
            <Show when={hasLink() || emailCount() > 0}>
              {/* On the content area's gray, so the icon doesn't show through the tint. */}
              <span class="pointer-events-none absolute left-0 top-0 rounded bg-gray-50">
                <span class="flex h-3.5 min-w-3.5 items-center justify-center rounded bg-green-500/20 px-0.5 font-mono text-[0.625rem] font-semibold leading-none text-green-600">
                  <Show when={!hasLink()} fallback={<div class="i-lucide:link h-2.5 w-2.5" />}>
                    {emailCount() > 9 ? "9+" : emailCount()}
                  </Show>
                </span>
              </span>
            </Show>
          </Suspense>
        </div>
      </Tooltip>
      {/* Its own boundary, so loading another entry's shares doesn't suspend the page. */}
      <Show when={mounted()}>
        <Suspense>
          <ShareDialog
            entryID={props.entryID}
            entryName={props.entryName}
            opened={opened()}
            onClose={() => setOpened(false)}
          />
        </Suspense>
      </Show>
    </>
  );
};

export { ShareButton };
