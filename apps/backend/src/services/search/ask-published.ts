import { completeAnswer } from "#backend/lib/search/answers";
import { preparePublishedAnswer } from "./prepare-published-answer";

const askPublished = async (input: Parameters<typeof preparePublishedAnswer>[0]) => {
  return completeAnswer(await preparePublishedAnswer(input));
};

export { askPublished };
