import { useEffect, useState } from "react";
import { Product } from "../types";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23161616'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%236b6560' font-family='Arial, sans-serif' font-size='28'%3EProduct image unavailable%3C/text%3E%3C/svg%3E";

const MAX_PRODUCTS = 3;

function getProductImages(product: Product) {
  let parsedImageUrls: string[] = [];

  if (Array.isArray(product.imageUrls)) {
    parsedImageUrls = product.imageUrls;
  } else if (typeof product.imageUrls === "string") {
    try {
      parsedImageUrls = JSON.parse(product.imageUrls || "[]") as string[];
    } catch {
      parsedImageUrls = [];
    }
  } else {
    parsedImageUrls = product.image_urls ?? [];
  }

  const galleryImages = product.galleryImages ?? product.gallery_images ?? parsedImageUrls;
  const thumbnailUrl =
    product.thumbnailUrl ??
    product.thumbnail_url ??
    product.imageUrl ??
    product.image_url;

  return Array.from(
    new Set(
      [...galleryImages, thumbnailUrl]
        .filter((image): image is string => Boolean(image && image.trim()))
    )
  );
}

function formatPrice(product: Product) {
  const rawPrice = (product.priceRange ?? product.price_range ?? "").trim();
  const category = product.category.toLowerCase();

  if (!rawPrice) return rawPrice;
  if (/(per\s+sqft|per\s+piece|per\s+set)/i.test(rawPrice)) {
    return rawPrice;
  }
  if (category.includes("breeze")) {
    return `${rawPrice} per piece`;
  }
  if (category.includes("mural")) {
    return `${rawPrice} per set`;
  }
  if (category.includes("brick") || category.includes("panel")) {
    return `${rawPrice} per sqft`;
  }

  return rawPrice;
}

export function ProductCarousel({ products, isMoreImages = false }: { products: Product[]; isMoreImages?: boolean }) {
  const [index, setIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);

  const visible = products.slice(0, MAX_PRODUCTS);
  const total = visible.length;

  useEffect(() => {
    setIndex(0);
  }, [products]);

  useEffect(() => {
    setImageIndex(0);
  }, [index, products]);

  if (!total) {
    return null;
  }

  const current = visible[index] ?? visible[0];
  const productUrl = current.productUrl ?? current.product_url;
  const images = getProductImages(current);
  const showImageGallery = isMoreImages || images.length > 1;
  const activeImage = images[imageIndex] ?? images[0] ?? PLACEHOLDER_IMAGE;

  function prev() {
    setIndex((value) => (value - 1 + total) % total);
  }

  function next() {
    setIndex((value) => (value + 1) % total);
  }

  function prevImage() {
    setImageIndex((value) => (value - 1 + images.length) % images.length);
  }

  function nextImage() {
    setImageIndex((value) => (value + 1) % images.length);
  }

  return (
    <section
      className="relative mt-4 w-full self-start rounded-[24px] p-4 animate-fade-up"
      style={{ background: "#111111", border: "1px solid #1f1f1f" }}
    >
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.28em]" style={{ color: "#6b6560" }}>
            Recommended Designs
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "#b8b0a4" }}>
            Picked to match your style and space.
          </p>
        </div>
        {total > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              aria-label="Previous product"
              className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150"
              style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", color: "#b8b0a4" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,169,110,0.4)"; (e.currentTarget as HTMLElement).style.color = "#e2c98f"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#2a2a2a"; (e.currentTarget as HTMLElement).style.color = "#b8b0a4"; }}
            >
              ‹
            </button>
            <span className="min-w-[36px] text-center font-mono text-[11px]" style={{ color: "#6b6560" }}>
              {index + 1} / {total}
            </span>
            <button
              onClick={next}
              aria-label="Next product"
              className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150"
              style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", color: "#b8b0a4" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,169,110,0.4)"; (e.currentTarget as HTMLElement).style.color = "#e2c98f"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#2a2a2a"; (e.currentTarget as HTMLElement).style.color = "#b8b0a4"; }}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Product card */}
      <article
        className="overflow-hidden rounded-[20px] transition-all duration-300"
        style={{ background: "#161616", border: "1px solid #1f1f1f" }}
      >
        {/* Image area */}
        <div className="relative">
          <img
            src={activeImage}
            alt={current.name}
            className="h-48 w-full object-cover md:h-56"
            style={{ background: "#1c1c1c" }}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = PLACEHOLDER_IMAGE;
            }}
          />

          {showImageGallery && images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white transition"
                style={{ background: "rgba(0,0,0,0.55)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.75)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.55)"; }}
              >
                ‹
              </button>
              <button
                onClick={nextImage}
                aria-label="Next image"
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white transition"
                style={{ background: "rgba(0,0,0,0.55)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.75)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.55)"; }}
              >
                ›
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full px-2 py-1" style={{ background: "rgba(0,0,0,0.45)" }}>
                {images.map((_, itemIndex) => (
                  <button
                    key={itemIndex}
                    onClick={() => setImageIndex(itemIndex)}
                    aria-label={`Go to image ${itemIndex + 1}`}
                    className="h-1.5 rounded-full transition-all duration-200"
                    style={{
                      width: itemIndex === imageIndex ? "20px" : "6px",
                      background: itemIndex === imageIndex ? "#c8a96e" : "rgba(255,255,255,0.4)"
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Card body */}
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold" style={{ color: "#f5f0eb" }}>
                {current.name}
              </h3>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: "#6b6560" }}>
                {current.category}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.25)", color: "#e2c98f" }}
            >
              {formatPrice(current)}
            </span>
          </div>

          <p className="text-xs" style={{ color: "#b8b0a4" }}>
            {current.dimensions}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "#b8b0a4" }}>
            {current.bestFor ?? current.best_for}
          </p>

          {/* Thumbnail strip */}
          {showImageGallery && images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((image, itemIndex) => (
                <button
                  key={`${current.id}-${itemIndex}`}
                  onClick={() => setImageIndex(itemIndex)}
                  className="overflow-hidden rounded-xl transition-all duration-150"
                  style={{
                    border: `1px solid ${itemIndex === imageIndex ? "#c8a96e" : "#2a2a2a"}`
                  }}
                >
                  <img
                    src={image}
                    alt={`${current.name} preview ${itemIndex + 1}`}
                    className="h-14 w-14 object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* View Product link — fixed from blue to amber */}
          {productUrl && (
            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium transition-all duration-150"
              style={{ color: "#c8a96e" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#e2c98f";
                (e.currentTarget as HTMLElement).style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#c8a96e";
                (e.currentTarget as HTMLElement).style.textDecoration = "none";
              }}
            >
              View Product →
            </a>
          )}
        </div>
      </article>

      {/* Pagination dots */}
      {total > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {visible.map((_, itemIndex) => (
            <button
              key={itemIndex}
              onClick={() => setIndex(itemIndex)}
              aria-label={`Go to product ${itemIndex + 1}`}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{
                width: itemIndex === index ? "20px" : "6px",
                background: itemIndex === index ? "#c8a96e" : "#2a2a2a"
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
