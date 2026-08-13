(function () {
  const STORAGE_MARKER = "/storage/v1/object/public/";

  function tileThumbnailUrl(source) {
    if (!source) return source;
    try {
      const url = new URL(source, window.location.origin);
      const markerIndex = url.pathname.indexOf(STORAGE_MARKER);
      if (markerIndex === -1) return source;
      const storagePath = url.pathname.slice(markerIndex + STORAGE_MARKER.length);
      const separator = storagePath.indexOf("/");
      if (separator === -1) return source;
      const bucket = storagePath.slice(0, separator);
      const objectPath = storagePath.slice(separator + 1);
      if (!objectPath || objectPath.startsWith("thumbnails/")) return source;
      const extensionIndex = objectPath.lastIndexOf(".");
      const filename = extensionIndex > objectPath.lastIndexOf("/")
        ? objectPath.slice(0, extensionIndex)
        : objectPath;
      return `${url.origin}${STORAGE_MARKER}${bucket}/thumbnails/${filename}.webp`;
    } catch (error) {
      return source;
    }
  }

  function setTileImage(image, source, placeholder = "/data/nourtechsmall.png") {
    if (!image) return;
    const thumbnail = tileThumbnailUrl(source || placeholder);
    let restoredOriginal = false;
    image.src = thumbnail;
    image.addEventListener("error", () => {
      if (!restoredOriginal && source && thumbnail !== source) {
        restoredOriginal = true;
        image.src = source;
        return;
      }
      if (!image.src.endsWith(placeholder)) image.src = placeholder;
    });
  }

  window.NourImages = { setTileImage, tileThumbnailUrl };
})();
