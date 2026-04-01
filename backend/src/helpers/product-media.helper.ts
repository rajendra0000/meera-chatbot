const SHADE_ASSET_NAMES = new Set([
  "ash-grey",
  "beton-grey",
  "solid-grey",
  "smoke-grey",
  "slate-grey",
  "charcoal-grey",
  "cobalt-blue",
  "cyan",
  "pensive-green",
  "opal-white",
  "mocha",
  "upscale-ivory",
  "worldly-beige",
  "wooden-brown",
  "puddle-brown",
  "earthy-pink",
  "rough-red",
  "rouge-red",
  "ochre",
  "mellow-green",
  "plain",
  "porous",
  "natural",
]);

const NON_GALLERY_KEYWORDS = [
  "dimension",
  "dimensions",
  "diemsion",
  "preview",
  "swatch",
  "texture",
  "shade",
  "finish",
  "colour",
  "color",
  "sample",
];

function normalizeAssetName(imageUrl: string) {
  const withoutQuery = imageUrl.split("?")[0] ?? imageUrl;
  const filename = withoutQuery.split("/").at(-1) ?? withoutQuery;
  return filename.replace(/\.[a-z0-9]+$/i, "").trim().toLowerCase();
}

function dedupeImages(images: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      images
        .map((image) => image?.trim() ?? "")
        .filter((image) => image.length > 0)
    )
  );
}

export function parseProductImages(imageUrls?: string | null) {
  if (!imageUrls) return [];

  try {
    const parsed = JSON.parse(imageUrls) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function isShadeAsset(imageUrl: string) {
  return SHADE_ASSET_NAMES.has(normalizeAssetName(imageUrl));
}

export function isNonGalleryAsset(imageUrl: string) {
  const normalized = normalizeAssetName(imageUrl);
  return NON_GALLERY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function resolveProductMedia(params: {
  imageUrl?: string | null;
  imageUrls?: string | null;
}) {
  const allImages = dedupeImages([params.imageUrl, ...parseProductImages(params.imageUrls)]);
  const shadeImages = allImages.filter((image) => isShadeAsset(image));
  const galleryImages = allImages.filter((image) => !isShadeAsset(image) && !isNonGalleryAsset(image));
  const thumbnailUrl = galleryImages[0] ?? null;

  return {
    thumbnailUrl,
    galleryImages,
    shadeImages,
  };
}
