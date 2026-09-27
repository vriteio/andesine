import type { JSX, ParentComponent } from "solid-js";

const Root: ParentComponent<JSX.HTMLAttributes<HTMLElement>> = (props) => {
  return <nav aria-label="Breadcrumbs" {...props} data-scope="breadcrumbs" data-part="root" />;
};
const List: ParentComponent<JSX.OlHTMLAttributes<HTMLOListElement>> = (props) => {
  return <ol {...props} data-scope="breadcrumbs" data-part="list" />;
};
const Item: ParentComponent<JSX.LiHTMLAttributes<HTMLLIElement>> = (props) => {
  return <li {...props} data-scope="breadcrumbs" data-part="item" />;
};
const Link: ParentComponent<JSX.AnchorHTMLAttributes<HTMLAnchorElement>> = (props) => {
  return <a {...props} data-scope="breadcrumbs" data-part="link" />;
};
/** An ancestor without a page. */
const Label: ParentComponent<JSX.HTMLAttributes<HTMLSpanElement>> = (props) => {
  return <span {...props} data-scope="breadcrumbs" data-part="label" />;
};
const Separator: ParentComponent<JSX.HTMLAttributes<HTMLSpanElement>> = (props) => {
  return <span aria-hidden="true" {...props} data-scope="breadcrumbs" data-part="separator" />;
};
const Breadcrumbs = { Root, List, Item, Link, Label, Separator };

export { Breadcrumbs };
