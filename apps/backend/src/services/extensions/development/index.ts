import { getArtifact } from "./get-artifact";
import { remove } from "./remove";
import { stop } from "./stop";
import { upload } from "./upload";

/** Local development extensions (`andesine extensions dev`). */
const development = { getArtifact, remove, stop, upload };

export { development };
