const hasFileDrag = (event: DragEvent): boolean => {
  // File type data can be unavailable until drop, especially for OS file drags.
  return (
    Array.from(event.dataTransfer?.types || []).includes("Files") ||
    Array.from(event.dataTransfer?.items || []).some((item) => item.kind === "file")
  );
};
const hasImageURL = (event: DragEvent): boolean => {
  return Array.from(event.dataTransfer?.types || []).some((type) =>
    ["text/uri-list", "text/plain"].includes(type)
  );
};
const readImageDrop = (event: DragEvent): File | string | null => {
  const file = Array.from(event.dataTransfer?.files || []).find((file) =>
    file.type.startsWith("image/")
  );

  if (file) return file;
  const value = (
    event.dataTransfer?.getData("text/uri-list") ||
    event.dataTransfer?.getData("text/plain") ||
    ""
  )
    .split(/\r?\n/)
    .find((line) => line.trim() && !line.startsWith("#"))
    ?.trim();

  try {
    const url = new URL(value || "");

    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

export { hasFileDrag, hasImageURL, readImageDrop };
