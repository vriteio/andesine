import { Button } from "@andesine/components";
import { type Component, createSignal } from "solid-js";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { AccountDeletionDialog } from "./confirm-deletion-dialog";

const AccountDeleteSection: Component = () => {
  const [opened, setOpened] = createSignal(false);

  return (
    <>
      <SettingsSection label="Danger zone">
        <Setting
          label="Delete account"
          description="Delete your account and the workspaces where you're the only admin"
          fade={false}
        >
          <Button variant="danger" onClick={() => setOpened(true)}>
            Delete account
          </Button>
        </Setting>
      </SettingsSection>
      <AccountDeletionDialog opened={opened()} onClose={() => setOpened(false)} />
    </>
  );
};

export { AccountDeleteSection };
