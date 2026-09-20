import { completeAnswer } from "#backend/lib/search/answers";
import { prepareCurrentAnswer } from "./prepare-current-answer";

const askCurrent = async (input: Parameters<typeof prepareCurrentAnswer>[0]) => {
  return completeAnswer(await prepareCurrentAnswer(input));
};

export { askCurrent };
