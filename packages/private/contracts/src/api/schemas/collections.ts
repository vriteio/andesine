import { collectionType } from "../../entities/collections";
import * as z from "zod";

const publicCollectionType = collectionType.extend({ path: z.string(), slugPath: z.string() });

export { publicCollectionType };
