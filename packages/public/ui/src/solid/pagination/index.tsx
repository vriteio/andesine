import { type JSX, type ParentComponent, splitProps } from "solid-js";

interface LinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  direction: "previous" | "next";
}

const Root: ParentComponent<JSX.HTMLAttributes<HTMLElement>> = (props) => {
  return <nav aria-label="Pages" {...props} data-scope="pagination" data-part="root" />;
};
const Link: ParentComponent<LinkProps> = (props) => {
  const [local, rest] = splitProps(props, ["direction"]);

  return (
    <a
      {...rest}
      rel={local.direction === "previous" ? "prev" : "next"}
      data-scope="pagination"
      data-part="link"
      data-direction={local.direction}
    />
  );
};
const Pagination = { Root, Link };

export { Pagination };
