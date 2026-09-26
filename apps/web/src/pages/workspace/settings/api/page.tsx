import { type Component, Show } from "solid-js";
import { useWorkspace } from "#web/context/workspace";
import { CredentialsSection } from "./credentials-section";
import { WebhooksSection } from "./webhooks-section";

const APISettingsPage: Component = () => {
  const { hasPermission } = useWorkspace();

  return (
    <>
      <Show when={hasPermission("read:api_keys")}>
        <CredentialsSection />
      </Show>
      <Show when={hasPermission("read:webhooks")}>
        <WebhooksSection />
      </Show>
    </>
  );
};

export default APISettingsPage;
