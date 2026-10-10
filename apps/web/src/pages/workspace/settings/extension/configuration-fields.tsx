import {
  type ExtensionConfiguration,
  type ExtensionConfigurationField
} from "@andesine/contracts/extensions";
import { Button, Checkbox, Input, Select, TagInput } from "@andesine/components";
import { type Component, For, type JSX, Match, Show, Switch } from "solid-js";
import { type SetStoreFunction } from "solid-js/store";
import { TimeAgo } from "#web/components/time-ago";
import { Setting } from "../setting";
import {
  type ConfigurationDraft,
  getFields,
  isNumericField,
  isSecretField
} from "./configuration-form";

interface ConfigurationFieldsProps {
  schema: ExtensionConfiguration | null;
  draft: ConfigurationDraft;
  setDraft: SetStoreFunction<ConfigurationDraft>;
  /** Update times of the secret fields that have a value. */
  secrets: Record<string, { updatedAt: string }>;
  errors: Record<string, string>;
  disabled: boolean;
}
interface FieldProps extends Omit<ConfigurationFieldsProps, "schema" | "errors"> {
  key: string;
  field: ExtensionConfigurationField;
  required: boolean;
}

const getInputType = (field: ExtensionConfigurationField): string => {
  if (isNumericField(field)) return "number";
  if ("format" in field && field.format === "uri") return "url";
  if ("format" in field && field.format === "email") return "email";

  return "text";
};
/** Secret fields are write-only: they show whether they are set, never their value. */
const SecretField: Component<FieldProps> = (props) => {
  const pending = () => props.draft.secrets[props.key];
  const stored = () => props.secrets[props.key];
  const setPending = (value: string | null | undefined) => {
    props.setDraft("secrets", props.key, value as string | null);
  };

  return (
    <div class="flex w-full max-w-md flex-col items-end gap-1">
      <Switch>
        <Match when={typeof pending() === "string"}>
          <div class="flex w-full items-center gap-1">
            <Input
              type="password"
              autocomplete="off"
              placeholder="New value"
              value={pending() ?? ""}
              setValue={setPending}
              disabled={props.disabled}
              class="w-full"
            />
            <Button variant="ghost" text="soft" onClick={() => setPending(undefined)}>
              Cancel
            </Button>
          </div>
        </Match>
        <Match when={pending() === null}>
          <div class="flex items-center gap-1 text-sm text-gray-500">
            Will be cleared
            <Button variant="ghost" text="soft" onClick={() => setPending(undefined)}>
              Undo
            </Button>
          </div>
        </Match>
        <Match when={pending() === undefined}>
          <div class="flex items-center gap-1 text-sm text-gray-500">
            <Show when={stored()} fallback={<span>Not set</span>}>
              {(secret) => (
                <span class="flex items-center gap-1">
                  Set <TimeAgo date={secret().updatedAt} />
                </span>
              )}
            </Show>
            <Show when={!props.disabled}>
              <Button variant="secondary" onClick={() => setPending("")}>
                {stored() ? "Replace" : "Set"}
              </Button>
              <Show when={stored() && !props.required}>
                <Button variant="ghost" text="soft" onClick={() => setPending(null)}>
                  Clear
                </Button>
              </Show>
            </Show>
          </div>
        </Match>
      </Switch>
    </div>
  );
};
const ValueField: Component<FieldProps> = (props) => {
  const value = () => props.draft.values[props.key];
  const setValue = (next: string | boolean | string[]) => {
    props.setDraft("values", props.key, next);
  };
  const options = () => {
    const values = "enum" in props.field ? (props.field.enum as string[]) : [];

    return [
      ...(props.required ? [] : [{ label: "None", value: "" }]),
      ...values.map((option) => ({ label: option, value: option }))
    ];
  };

  return (
    <Switch
      fallback={
        <Input
          type={getInputType(props.field)}
          value={value() as string}
          setValue={setValue}
          disabled={props.disabled}
          class="w-full max-w-md"
        />
      }
    >
      <Match when={props.field.type === "boolean"}>
        <Checkbox checked={value() as boolean} setChecked={setValue} disabled={props.disabled} />
      </Match>
      <Match when={"enum" in props.field}>
        <Select
          options={options()}
          value={value() as string}
          setValue={setValue}
          disabled={props.disabled}
          placeholder="Select"
          class="w-full max-w-md"
        />
      </Match>
      <Match when={props.field.type === "array"}>
        <TagInput
          values={value() as string[]}
          setValues={setValue}
          disabled={props.disabled}
          placeholder="Add a value"
          commitOnEnter
          disableAutoFocus
        />
      </Match>
    </Switch>
  );
};
const ConfigurationFields: Component<ConfigurationFieldsProps> = (props) => (
  <For
    each={getFields(props.schema)}
    fallback={<span class="py-2 text-sm text-gray-400">This extension has no configuration.</span>}
  >
    {([key, field]) => {
      const required = () => props.schema?.required?.includes(key) ?? false;
      const label = (): JSX.Element => (
        <span class="flex items-center gap-1">
          {field.title || key}
          <Show when={required()}>
            <span class="text-red-500">*</span>
          </Show>
        </span>
      );
      const description = (): JSX.Element => (
        <>
          {field.description}
          <Show when={props.errors[key]}>
            <span class="block text-red-500">{props.errors[key]}</span>
          </Show>
        </>
      );

      return (
        <Setting label={label()} description={description()} fade={false}>
          <Show
            when={isSecretField(field)}
            fallback={<ValueField {...props} key={key} field={field} required={required()} />}
          >
            <SecretField {...props} key={key} field={field} required={required()} />
          </Show>
        </Setting>
      );
    }}
  </For>
);

export { ConfigurationFields };
