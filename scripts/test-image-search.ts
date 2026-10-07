import { ImageSearchService } from "../src/app/modules/imageSearch/imageSearch.service";
import { generateImageEmbeddingFromBuffer } from "../src/app/utils/imageEmbedding";
import { prisma } from "../src/app/lib/prisma";

async function runTest() {
  console.log("🧪 Testing Image Search Service...");

  // Create a synthetic image buffer (e.g. 64x64 blue & gold pixels)
  const dummyBuffer = Buffer.alloc(64 * 64 * 3);
  for (let i = 0; i < dummyBuffer.length; i += 3) {
    dummyBuffer[i] = 40; // R
    dummyBuffer[i + 1] = 120; // G
    dummyBuffer[i + 2] = 220; // B (dominant blue)
  }

  const embedding = generateImageEmbeddingFromBuffer(dummyBuffer);
  console.log(`✅ Generated embedding dimensions: ${embedding.length}`);

  const searchResult = await ImageSearchService.searchByImageBuffer(dummyBuffer, 8, 0.1);
  console.log(`✅ Search result total found: ${searchResult.totalFound}`);
  console.log("Top matched products:");
  searchResult.results.slice(0, 3).forEach((p, idx) => {
    console.log(`  ${idx + 1}. [${p.similarityPercentage}% match] ${p.title} - $${p.basePrice} (Vendor: ${p.vendor?.storeName || 'N/A'})`);
  });

  await prisma.$disconnect();
  console.log("🎉 Test completed successfully!");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
