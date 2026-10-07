import { prisma } from "../src/app/lib/prisma";
import { generateImageEmbeddingFromUrl } from "../src/app/utils/imageEmbedding";

/**
 * Background script to generate and sync image embeddings for all products
 */
async function syncEmbeddings() {
  console.log("🚀 Starting Image Embedding Sync for Products...");

  const startTime = Date.now();

  try {
    const products = await prisma.product.findMany({
      where: {
        images: { isEmpty: false },
      },
      select: {
        id: true,
        title: true,
        images: true,
        imageEmbedding: true,
      },
    });

    console.log(`📦 Found ${products.length} products with images.`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const primaryImage = product.images[0];

      // Skip if embedding already exists and is non-empty
      if (product.imageEmbedding && product.imageEmbedding.length > 0) {
        skippedCount++;
        continue;
      }

      if (!primaryImage) {
        skippedCount++;
        continue;
      }

      try {
        process.stdout.write(`[${i + 1}/${products.length}] Processing: "${product.title.slice(0, 30)}"... `);
        const embedding = await generateImageEmbeddingFromUrl(primaryImage);

        if (embedding && embedding.length > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: { imageEmbedding: embedding },
          });
          updatedCount++;
          console.log(`✅ Embedding generated (${embedding.length} dims)`);
        } else {
          console.log(`⚠️ Empty embedding generated`);
        }
      } catch (err) {
        errorCount++;
        console.log(`❌ Error:`, err);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n==========================================");
    console.log("✨ Image Embedding Sync Summary:");
    console.log(`   - Total checked: ${products.length}`);
    console.log(`   - Newly updated: ${updatedCount}`);
    console.log(`   - Already had embedding / skipped: ${skippedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Duration: ${duration}s`);
    console.log("==========================================\n");
  } catch (error) {
    console.error("Fatal error during syncEmbeddings:", error);
  } finally {
    await prisma.$disconnect();
  }
}

syncEmbeddings();
