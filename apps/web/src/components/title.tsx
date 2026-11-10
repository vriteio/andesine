import { Title as MetaTitle } from "@solidjs/meta";
import { type Component } from "solid-js";

interface TitleProps {
  children: string;
}

/**
 * A title from data that can fail, e.g. a workspace query. The page's error still reaches its
 * error boundary; the title falls back, as every later title reads it and would throw again.
 */
const Title: Component<TitleProps> = (props) => {
  const read = () => {
    try {
      return props.children;
    } catch {
      return "Andesine";
    }
  };

  return <MetaTitle>{read()}</MetaTitle>;
};

export { Title };
