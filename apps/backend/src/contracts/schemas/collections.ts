import { collectionType } from "#backend/db/collections";
import * as z from "zod";

const publicCollectionType = collectionType.extend({ path: z.string() });

export { publicCollectionType };
