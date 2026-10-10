// Type-only check (not bundled): authoring props must match the host component definitions.
import type {
  ExtensionComponentName,
  ExtensionComponentProps,
  extensionComponentDefinitions
} from "@andesine/contracts/extensions";
import type * as Props from "./components";

interface AuthoringProps {
  Stack: Props.StackProps;
  Grid: Props.GridProps;
  Box: Props.BoxProps;
  Divider: Props.EmptyProps;
  ScrollArea: Props.ScrollAreaProps;
  Text: Props.TextProps;
  Heading: Props.HeadingProps;
  Code: Props.ParentProps;
  Link: Props.LinkProps;
  Badge: Props.BadgeProps;
  Icon: Props.IconProps;
  Button: Props.ButtonProps;
  IconButton: Props.IconButtonProps;
  Input: Props.InputProps;
  Textarea: Props.TextareaProps;
  Select: Props.ChoiceProps;
  Combobox: Props.ChoiceProps;
  Checkbox: Props.ToggleProps;
  Toggle: Props.ToggleProps;
  ToggleGroup: Props.ToggleGroupProps;
  ColorInput: Props.ColorInputProps;
  Tooltip: Props.TooltipProps;
  Dialog: Props.DialogProps;
  Menu: Props.MenuProps;
  MenuTrigger: Props.ParentProps;
  MenuItem: Props.MenuItemProps;
  MenuGroup: Props.MenuGroupProps;
  MenuSeparator: Props.EmptyProps;
  MenuContent: Props.ParentProps;
  Setting: Props.SettingProps;
  List: Props.ListProps;
  Card: Props.CardProps;
  Tree: Props.TreeProps;
  Tabs: Props.TabsProps;
  Tab: Props.TabProps;
  Disclosure: Props.DisclosureProps;
  Callout: Props.CalloutProps;
  Steps: Props.ParentProps;
  Step: Props.StepProps;
  Figure: Props.FigureProps;
  CodeBlock: Props.CodeBlockProps;
  TimeAgo: Props.TimeAgoProps;
  Spinner: Props.SpinnerProps;
  Skeleton: Props.SkeletonProps;
  ContentSlot: Props.EmptyProps;
}

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;
type EventName<N extends ExtensionComponentName> =
  keyof (typeof extensionComponentDefinitions)[N]["events"];
type Matches<N extends ExtensionComponentName> = [
  Same<Omit<AuthoringProps[N], "children" | EventName<N>>, ExtensionComponentProps<N>>,
  Same<
    Exclude<keyof AuthoringProps[N], keyof ExtensionComponentProps<N> | "children">,
    EventName<N>
  >
] extends [true, true]
  ? true
  : false;
type AllMatch<N extends ExtensionComponentName = ExtensionComponentName> =
  N extends ExtensionComponentName ? Matches<N> : never;
type ComponentChecks = [
  Expect<AllMatch extends true ? true : false>,
  Expect<Same<keyof AuthoringProps, ExtensionComponentName>>
];

export type { ComponentChecks };
