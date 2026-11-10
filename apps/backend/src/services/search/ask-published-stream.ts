import { streamAnswer, type AnswerStreamOptions } from "#backend/lib/search/answers";
import { preparePublishedAnswer } from "./prepare-published-answer";

const askPublishedStream = async (
  input: Parameters<typeof preparePublishedAnswer>[0],
  options?: AnswerStreamOptions
) => {
  return streamAnswer(await preparePublishedAnswer(input), options);
};

export { askPublishedStream };
