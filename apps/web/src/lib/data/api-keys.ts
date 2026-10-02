import { createMutation } from "@tanstack/solid-query";
import { query, revalidate } from "@solidjs/router";
import { client, type KeyKind } from "#web/lib/api";
import { useNotify } from "#web/context/notifications";

interface KeyMutationsInput {
  keyID(): string | null;
  navigateToAPI(): void;
  onCreated(rawKey: string, kind: KeyKind): void;
}

type CreateKeyVariables = Parameters<typeof client.keys.create>[0];
type UpdateKeyVariables = Parameters<typeof client.keys.update>[0];

const apiKeysQuery = query(() => client.keys.list(), "api-keys");
const apiKeyQuery = query(
  (input: { keyID: string }) => client.keys.get({ id: input.keyID }),
  "api-key"
);

const useKeyMutations = (input: KeyMutationsInput) => {
  const notify = useNotify();
  const createKeyMutation = createMutation(() => ({
    mutationFn: (variables: CreateKeyVariables) => client.keys.create(variables),
    onSuccess: (data) => {
      input.onCreated(data.rawKey, data.kind);
      void revalidate(apiKeysQuery.key);
    },
    onError: (error) => {
      console.error(error);
      notify({ type: "error", text: "Failed to create key" });
    }
  }));
  const updateKeyMutation = createMutation(() => ({
    mutationFn: (variables: UpdateKeyVariables) => client.keys.update(variables),
    onSuccess: () => {
      const keyID = input.keyID();
      void revalidate([apiKeysQuery.key, ...(keyID ? [apiKeyQuery.keyFor({ keyID })] : [])]);
      input.navigateToAPI();
    },
    onError: (error) => {
      console.error(error);
      notify({ type: "error", text: "Failed to update key" });
    }
  }));

  return { createKeyMutation, updateKeyMutation };
};

export { apiKeyQuery, apiKeysQuery, useKeyMutations };
