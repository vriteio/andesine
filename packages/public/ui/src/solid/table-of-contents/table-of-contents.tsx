import { type JSX, type ParentComponent, createContext, splitProps, useContext } from "solid-js";
import { focusTarget } from "../../core/focus";
import {
  type TableOfContents as TableOfContentsState,
  createTableOfContents
} from "./create-table-of-contents";

interface RootProps extends JSX.HTMLAttributes<HTMLElement> {
  headingIDs: string[];
}

interface LinkProps extends Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  headingID: string;
}

const Context = createContext<TableOfContentsState>();

const useTableOfContents = (): TableOfContentsState => {
  const state = useContext(Context);

  if (!state) throw new Error("TableOfContents parts must be inside TableOfContents.Root.");

  return state;
};
const Root: ParentComponent<RootProps> = (props) => {
  const [local, rest] = splitProps(props, ["headingIDs"]);
  const state = createTableOfContents({ headingIDs: () => local.headingIDs });

  return (
    <Context.Provider value={state}>
      <nav aria-label="On this page" {...rest} data-scope="table-of-contents" data-part="root" />
    </Context.Provider>
  );
};
const List: ParentComponent<JSX.HTMLAttributes<HTMLUListElement>> = (props) => {
  return <ul {...props} data-scope="table-of-contents" data-part="list" />;
};
const Item: ParentComponent<JSX.LiHTMLAttributes<HTMLLIElement>> = (props) => {
  return <li {...props} data-scope="table-of-contents" data-part="item" />;
};
/** Links to a heading, marks it as current, and moves focus to it after navigation. */
const Link: ParentComponent<LinkProps> = (props) => {
  const [local, rest] = splitProps(props, ["headingID"]);
  const state = useTableOfContents();
  const onClick = (event: MouseEvent): void => {
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (!isPlainClick) return;

    state.select(local.headingID);
    requestAnimationFrame(() => {
      const heading = document.getElementById(local.headingID);

      if (heading) focusTarget(heading);
    });
  };

  return (
    <a
      {...rest}
      href={`#${encodeURIComponent(local.headingID)}`}
      aria-current={state.activeID() === local.headingID ? "location" : undefined}
      data-visible={state.visibleIDs().includes(local.headingID) || undefined}
      data-scope="table-of-contents"
      data-part="link"
      onClick={onClick}
    />
  );
};
const TableOfContents = { Root, List, Item, Link };

export { TableOfContents, useTableOfContents };
