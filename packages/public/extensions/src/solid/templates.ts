import { createComponent, createContext, onCleanup, useContext, type JSX } from "solid-js";
import { BlockPresentation } from "./components";
import { ViewContext } from "./editor";

/** A direct child block of an element; root element views receive them as `children`. */
interface ElementChild {
  /** The node ID. */
  key: string;
  /** The node type, e.g. `element`, `paragraph`, or `codeBlock`. */
  type: string;
  element?: string;
  props?: Record<string, unknown>;
  language?: string;
  /** A code block's title, e.g. its tab label in a code group. */
  title?: string;
  /** Whether the editor's text cursor or a text selection is in it. */
  hasSelection: boolean;
  /** Whether a block selection selects it, e.g. after a right click on it, not the element around it. */
  blockSelected: boolean;
  /**
   * Whether the editor's drag handle and block menu, in the gutter, are for it, e.g. while it's
   * hovered; views can mark it, e.g. with an outline.
   */
  handleTarget: boolean;
  /** Whether a drop now goes to it, from a droppable `BlockArea`, e.g. to mark the place it takes. */
  dropTarget: boolean;
  /** Whether the editor drags it, e.g. to fade it. */
  dragged: boolean;
}
/** What an `<Element>` template receives for each child element it draws. */
interface ElementTemplateProps<T = Record<string, unknown>> {
  element: string;
  props: T;
  /** The position among the siblings with the same name, e.g. 0 for the first tab. */
  index: number;
  /** Whether a block selection selects the element itself, e.g. after a right click on its UI. */
  blockSelected: boolean;
  /**
   * Whether a block selection holds the element, itself or with an element around it, e.g. a
   * file in a selected folder; views can mark its UI, e.g. tint its icon.
   */
  inBlockSelection: boolean;
  /** Whether a drop now goes to the element, from a droppable `BlockArea`. */
  dropTarget: boolean;
  /** Whether the editor drags the element. */
  dragged: boolean;
  /** The node ID, as in the root view's `children`. */
  key: string;
  /** Its own direct child blocks, e.g. to hide an empty folder's content. */
  children: ElementChild[];
}
interface ElementProps<T> {
  /** The child element's name, e.g. `Tab`. */
  tag: string;
  children(child: ElementTemplateProps<T>): JSX.Element;
}
interface BlockProps {
  /** The child block's node type, e.g. `codeBlock`. */
  type: string;
  /** `plain` blocks have no frame or background of their own, e.g. code blocks in a code group. */
  children(block: ElementChild): { hidden?: boolean; plain?: boolean };
}

type Template = (child: ElementTemplateProps) => JSX.Element;

/** The props of the view a component is in, e.g. a root view's `children` for `<Block>`. */
const ViewPropsContext = createContext<{ children?: ElementChild[] }>();
const templates = new Map<string, Template>();
const waiting = new Map<string, Array<(template: Template) => void>>();

const getTemplateKey = (rootViewID: string, tag: string): string => {
  return `${rootViewID}\n${tag.toLowerCase()}`;
};
/** Runs with the template once the root view has rendered its `<Element>`. */
const whenTemplate = (rootViewID: string, tag: string, run: (template: Template) => void) => {
  const key = getTemplateKey(rootViewID, tag);
  const template = templates.get(key);

  if (template) return run(template);

  waiting.set(key, [...(waiting.get(key) ?? []), run]);
};
/**
 * Draws the root element's descendant elements of `tag`, e.g. each `Tab` of a `Tabs` view; put it
 * directly inside the root view's `ContentSlot`. Each child is still its own element, so its
 * `ContentSlot` holds its own content; the template can use the root view's state.
 */
const Element = <T = Record<string, unknown>>(props: ElementProps<T>): JSX.Element => {
  const key = getTemplateKey(useContext(ViewContext) ?? "", props.tag);
  const template = ((child: ElementTemplateProps<T>) => props.children(child)) as Template;

  templates.set(key, template);
  waiting.get(key)?.forEach((run) => run(template));
  waiting.delete(key);
  onCleanup(() => templates.delete(key));

  return undefined;
};
/**
 * The presentation of the root element's child blocks of `type`, e.g. code blocks, which the
 * editor draws itself: `hidden` or `plain`. Put it directly inside the `ContentSlot`.
 */
const Block = (props: BlockProps): JSX.Element => {
  const view = useContext(ViewPropsContext);
  const keys = (option: "hidden" | "plain") => {
    return (view?.children ?? [])
      .filter((block) => block.type === props.type && props.children(block)[option])
      .map(({ key }) => key);
  };

  return createComponent(BlockPresentation, {
    get hidden() {
      return keys("hidden");
    },
    get plain() {
      return keys("plain");
    }
  });
};

export { Block, Element, ViewPropsContext, whenTemplate };
export type { BlockProps, ElementChild, ElementProps, ElementTemplateProps };
