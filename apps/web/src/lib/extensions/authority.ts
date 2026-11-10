import {
  getEffectiveExtensionPermissions,
  type ExtensionConfigurationState,
  type ExtensionPermission
} from "@andesine/contracts/extensions";
import { type Permission } from "@andesine/contracts/entities";
import { client } from "#web/lib/api";
import { createEffect, createMemo, createRoot, createSignal, onCleanup } from "solid-js";
import { type ExtensionHost } from "./host";

interface ExtensionMember {
  workspaceID: string;
  admin: boolean;
  permissions: Permission[];
}
interface ExtensionContextInput {
  extensionID: string;
  host: ExtensionHost;
  grant: ExtensionPermission[];
  backend: string | null;
}

type MemberSource = () => ExtensionMember | null;

const RETRY_DELAY = 30_000;
const MIN_RENEWAL_DELAY = 10_000;
const [memberSource, setMemberSource] = createSignal<MemberSource>(() => null);
const [updatedExtension, setUpdatedExtension] = createSignal<string | null>(null, {
  equals: false
});

const setExtensionMember = (source: MemberSource): (() => void) => {
  setMemberSource(() => source);

  return () => {
    if (memberSource() === source) setMemberSource(() => () => null);
  };
};
const getExtensionMember = (): ExtensionMember | null => memberSource()();
/** Reloads the context of a running extension. */
const notifyExtensionUpdate = (extensionID: string): void => {
  setUpdatedExtension(extensionID);
};
/** The frontend authority: the extension's grant limited to the current member (reactive). */
const getEffectivePermissions = (grant: ExtensionPermission[]): ExtensionPermission[] => {
  const member = getExtensionMember();

  return member ? getEffectiveExtensionPermissions(grant, member) : [];
};
/** Keeps a running extension's context and backend session token current; returns the stop. */
const startExtensionContext = (input: ExtensionContextInput): (() => void) => {
  return createRoot((dispose) => {
    const [configuration, setConfiguration] = createSignal<ExtensionConfigurationState["values"]>(
      {}
    );
    const updates = createMemo((count: number) => {
      return updatedExtension() === input.extensionID ? count + 1 : count;
    }, 0);

    createEffect(() => {
      updates();

      if (!getExtensionMember()) return;

      let stopped = false;

      client.extensions.getConfiguration({ extensionID: input.extensionID }).then(
        ({ values }) => {
          if (!stopped) setConfiguration(values);
        },
        () => {}
      );
      onCleanup(() => {
        stopped = true;
      });
    });

    createEffect(() => {
      input.host.setContext({
        permissions: getEffectivePermissions(input.grant),
        backend: input.backend,
        configuration: configuration()
      });
    });

    if (input.backend) {
      createEffect(() => {
        const member = getExtensionMember();

        let timer: ReturnType<typeof setTimeout> | undefined;
        let stopped = false;

        const renew = async (): Promise<void> => {
          try {
            const session = await client.extensions.createSessionToken({
              extensionID: input.extensionID
            });
            const remaining = new Date(session.expiresAt).getTime() - Date.now();

            if (stopped) return;

            input.host.setSession(session);
            timer = setTimeout(renew, Math.max(remaining * 0.8, MIN_RENEWAL_DELAY));
          } catch {
            if (stopped) return;

            input.host.setSession(null);
            timer = setTimeout(renew, RETRY_DELAY);
          }
        };

        input.host.setSession(null);

        if (member) void renew();

        onCleanup(() => {
          stopped = true;
          clearTimeout(timer);
        });
      });
    }

    return dispose;
  });
};

export {
  setExtensionMember,
  getExtensionMember,
  getEffectivePermissions,
  notifyExtensionUpdate,
  startExtensionContext
};
export type { ExtensionMember };
