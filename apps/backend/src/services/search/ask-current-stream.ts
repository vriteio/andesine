import { streamAnswer, type AnswerStreamOptions } from "#backend/lib/search/answers";
import { prepareCurrentAnswer } from "./prepare-current-answer";

const askCurrentStream = async (
  input: Parameters<typeof prepareCurrentAnswer>[0],
  options?: AnswerStreamOptions
) => {
  return streamAnswer(await prepareCurrentAnswer(input), options);
};

export { askCurrentStream };
