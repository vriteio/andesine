/** Small section labels, like the group labels of the search palette. */
const labelClass = "not-prose px-1 py-0.5 text-xs leading-normal text-gray-400";

/** Names of fields and security schemes; unlike values, not styled as inline code. */
const nameClass = "not-prose font-mono text-sm font-semibold text-gray-900";

/** Markdown descriptions, without the outer margins of their first and last blocks. */
const descriptionClass =
  "prose max-w-none text-gray-600 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

/** Marks required fields, after their names. */
const requiredClass = "font-semibold text-tertiary";

export { labelClass, nameClass, descriptionClass, requiredClass };
