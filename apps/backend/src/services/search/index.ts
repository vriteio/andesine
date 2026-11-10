import { askCurrent } from "./ask-current";
import { askPublished } from "./ask-published";
import { askCurrentStream } from "./ask-current-stream";
import { askPublishedStream } from "./ask-published-stream";
import { searchCurrent } from "./current";
import { searchPublished } from "./published";

const Search = {
  askCurrentStream,
  askPublishedStream,
  askCurrent,
  askPublished,
  current: searchCurrent,
  published: searchPublished
};

export { Search };
