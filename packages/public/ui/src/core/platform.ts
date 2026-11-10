/** Apple devices use Command in place of Ctrl for shortcuts. */
const isApplePlatform = (): boolean => {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
};

export { isApplePlatform };
