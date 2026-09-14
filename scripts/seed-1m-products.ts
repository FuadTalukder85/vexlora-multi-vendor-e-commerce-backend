import "dotenv/config";
import { prisma } from "../src/app/lib/prisma";
import { ProductStatus } from "../src/generated/prisma/enums";

/**
 * High-performance 1 Million Product Seeder
 * Features:
 * - Chunked batch insertion (10,000 records per batch) to prevent memory heap overflow.
 * - Dynamic fallback creation of required Vendor & Category records.
 * - High-speed unique slug & SKU generation.
 * - CLI parameter overrides: `npx tsx scripts/seed-1m-products.ts --count=1000000 --batch=10000`
 */

const args = process.argv.slice(2).reduce((acc: Record<string, string>, arg) => {
  const [key, value] = arg.split("=");
  if (key.startsWith("--")) {
    acc[key.replace("--", "")] = value;
  }
  return acc;
}, {});

const TOTAL_RECORDS = parseInt(args.count || "1000000", 10);
const BATCH_SIZE = parseInt(args.batch || "10000", 10);

const BRANDS = ["TechCorp", "ApexStyle", "NovaGear", "AuraHome", "LuxeCraft", "ZenithFit", "VeloSpeed", "UrbanPulse"];
const TAG_POOL = ["electronics", "fashion", "home", "fitness", "trending", "featured", "sale", "new-arrival"];
const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
  "https://images.unsplash.com/photo-1560343090-f0409e92791a",
];

async function seed1MProducts() {
  console.log(`\n🚀 Starting 1M Product Seeder`);
  console.log(`- Target Count: ${TOTAL_RECORDS.toLocaleString()} products`);
  console.log(`- Batch Size:   ${BATCH_SIZE.toLocaleString()} per chunk`);
  console.log(`- Total Batches: ${Math.ceil(TOTAL_RECORDS / BATCH_SIZE)}\n`);

  const startTime = Date.now();

  // 1. Ensure at least one VendorProfile exists
  let vendor = await prisma.vendorProfile.findFirst({ select: { id: true } });
  if (!vendor) {
    console.log("⚠️ No VendorProfile found. Creating default seed vendor...");
    const dummyUser = await prisma.user.create({
      data: {
        name: "Seed Vendor User",
        email: `seed-vendor-${Date.now()}@example.com`,
        role: "VENDOR",
      },
    });
    vendor = await prisma.vendorProfile.create({
      data: {
        userId: dummyUser.id,
        storeName: "Global Mega Store",
        storeSlug: `global-mega-store-${Date.now()}`,
        status: "APPROVED",
      },
      select: { id: true },
    });
  }
  const vendorId = vendor.id;

  // 2. Ensure categories exist
  let categories = await prisma.category.findMany({ select: { id: true } });
  if (categories.length === 0) {
    console.log("⚠️ No categories found. Creating default seed categories...");
    const categoryNames = ["Electronics", "Fashion & Apparel", "Home & Living", "Sports & Outdoors", "Beauty & Care"];
    const createdCats = [];
    for (const name of categoryNames) {
      const cat = await prisma.category.create({
        data: {
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now(),
        },
        select: { id: true },
      });
      createdCats.push(cat);
    }
    categories = createdCats;
  }
  const categoryIds = categories.map((c) => c.id);

  // 3. Batch Seeding Loop
  const totalBatches = Math.ceil(TOTAL_RECORDS / BATCH_SIZE);
  let seededCount = 0;
  const runTimestamp = Date.now().toString(36);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStartTime = Date.now();
    const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_RECORDS - seededCount);

    const batchData = new Array(currentBatchSize);

    for (let i = 0; i < currentBatchSize; i++) {
      const globalIndex = seededCount + i + 1;
      const brand = BRANDS[globalIndex % BRANDS.length];
      const categoryId = categoryIds[globalIndex % categoryIds.length];
      const basePrice = (10 + (globalIndex % 990) + (globalIndex % 100) / 100).toFixed(2);
      const discountPrice = globalIndex % 3 === 0 ? (parseFloat(basePrice) * 0.85).toFixed(2) : null;

      batchData[i] = {
        vendorId,
        categoryId,
        title: `Pro Product #${globalIndex} ${brand}`,
        slug: `prod-${runTimestamp}-${globalIndex}`,
        description: `High-quality ${brand} product item #${globalIndex} with top performance and premium build.`,
        brand,
        images: [SAMPLE_IMAGES[globalIndex % SAMPLE_IMAGES.length]],
        basePrice: parseFloat(basePrice),
        discountPrice: discountPrice ? parseFloat(discountPrice) : null,
        totalStock: (globalIndex % 250) + 10,
        status: ProductStatus.ACTIVE,
        ratingAvg: parseFloat((3.5 + (globalIndex % 15) / 10).toFixed(2)),
        ratingCount: (globalIndex % 120) + 1,
        tags: [TAG_POOL[globalIndex % TAG_POOL.length], TAG_POOL[(globalIndex + 1) % TAG_POOL.length]],
      };
    }

    // Insert batch using Prisma createMany
    await prisma.product.createMany({
      data: batchData,
      skipDuplicates: true,
    });

    seededCount += currentBatchSize;
    const batchDurationSec = ((Date.now() - batchStartTime) / 1000).toFixed(2);
    const totalElapsedMin = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    const progressPercent = ((seededCount / TOTAL_RECORDS) * 100).toFixed(1);

    console.log(
      `[Batch ${batchIndex + 1}/${totalBatches}] ` +
        `Progress: ${progressPercent}% | ` +
        `Seeded: ${seededCount.toLocaleString()} / ${TOTAL_RECORDS.toLocaleString()} | ` +
        `Batch Time: ${batchDurationSec}s | ` +
        `Elapsed: ${totalElapsedMin}m`,
    );
  }

  const totalTimeMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`\n✅ Successfully seeded ${seededCount.toLocaleString()} products in ${totalTimeMinutes} minutes!`);
}

seed1MProducts()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
