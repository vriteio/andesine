interface ImageDimensions {
  width: number;
  height: number;
}

const getImageSize = (width: number, contentWidth: number): number =>
  contentWidth > 0 ? Math.min(100, Math.max(20, (width / contentWidth) * 100)) : 100;

const readImageDimensions = (file: File, signal: AbortSignal): Promise<ImageDimensions | null> =>
  new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    const finish = (dimensions: ImageDimensions | null) => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
      image.src = "";
      URL.revokeObjectURL(url);
      resolve(dimensions);
    };
    const abort = () => finish(null);

    if (signal.aborted) return finish(null);
    image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
    // A failed preview must not replace the backend's image validation.
    image.onerror = () => finish(null);
    signal.addEventListener("abort", abort, { once: true });
    image.src = url;
  });

export { getImageSize, readImageDimensions };
