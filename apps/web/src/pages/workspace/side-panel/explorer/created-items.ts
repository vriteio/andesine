/** Items just created in the explorer; once their name input closes, entries open and collections expand. */
const createdItemIDs = new Set<string>();

const markCreated = (id: string | undefined): string => {
  if (id) createdItemIDs.add(id);

  return id ?? "";
};
const takeCreated = (id: string): boolean => createdItemIDs.delete(id);

export { markCreated, takeCreated };
