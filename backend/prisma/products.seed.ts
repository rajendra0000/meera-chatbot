import { PrismaClient } from "@prisma/client";
import { access, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

type SourceProduct = {
  name: string;
  url?: string;
  category?: string;
  price?: string;
  dimensions?: string;
  description?: string;
  best_for?: string;
  textures?: string[];
  images?: string[];
};

const FALLBACK_IMAGE = "https://placehold.co/800x600/111827/F9FAFB?text=Hey+Concrete";

function slugifyProductName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePrice(price?: string) {
  if (!price) return "Flexible";
  return price.trim()
    .replace(/Rs\.\s*/g, "₹")
    .replace(/Rs\s+/g, "₹");
}

function normalizeDimensions(dimensions?: string) {
  return dimensions?.trim() || "Panel based";
}

function normalizeBestFor(bestFor?: string) {
  return bestFor?.trim() || "Interior and exterior feature spaces";
}

function inferUnitDesc(category: string, dimensions: string) {
  const normalizedCategory = category.toLowerCase();
  const normalizedDimensions = dimensions.toLowerCase();

  if (normalizedCategory.includes("mural") || normalizedDimensions.startsWith("set of")) {
    return "per set";
  }

  if (normalizedCategory.includes("breeze")) {
    return "per piece";
  }

  return "per sqft";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSourceProducts() {
  const candidatePaths = [
    path.join(__dirname, "data", "heyconcrete_products.json"),
    path.resolve(process.cwd(), "prisma", "data", "heyconcrete_products.json"),
    path.resolve(process.cwd(), "backend", "prisma", "data", "heyconcrete_products.json")
  ];
  let filePath = candidatePaths[0];

  for (const candidatePath of candidatePaths) {
    try {
      await access(candidatePath);
      filePath = candidatePath;
      break;
    } catch {
      continue;
    }
  }

  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { products?: SourceProduct[] };
  return parsed.products ?? [];
}

export async function seedProducts(prisma: PrismaClient) {
  const sourceProducts = await loadSourceProducts();
  const products = sourceProducts.map((product) => {
    const category = product.category?.trim() || "Wall Panels (H-UHPC)";
    const dimensions = normalizeDimensions(product.dimensions);
    const images = product.images?.filter((image) => image.trim()) ?? [];

    return {
      id: slugifyProductName(product.name),
      name: product.name.trim(),
      category,
      priceRange: normalizePrice(product.price),
      dimensions,
      unitDesc: inferUnitDesc(category, dimensions),
      imageUrl: images[0] ?? FALLBACK_IMAGE,
      imageUrls: JSON.stringify(images),
      bestFor: normalizeBestFor(product.best_for),
      description: product.description?.trim() || null,
      textures: product.textures?.filter((texture) => texture.trim()).join(", ") || null,
      productUrl: product.url?.trim() || null
    };
  });

  await prisma.product.deleteMany();

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product
    });
  }
}
