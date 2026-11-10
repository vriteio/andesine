import { activateSearchCollections } from "@andesine/server/search";
import { searchCollectionDefinitions, typesenseClient } from "./search/client";

// Operator command: moves the search aliases to this version's collections. Run it after all
// workers of the previous version stopped, as they still write through the aliases.
await activateSearchCollections(typesenseClient, searchCollectionDefinitions);
console.log("Search aliases activated");
process.exit(0);
