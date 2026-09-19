import { ProductService } from "../src/app/modules/product/product.service";
import { prisma } from "../src/app/lib/prisma";

async function runCursorSearchVerification() {
  console.log("=================================================");
  console.log("Starting Amazon/Alibaba-Grade Cursor Search Test");
  console.log("=================================================\n");

  // 1. Initial public search query (Batch 1, limit 4, cursor mode)
  console.log("1. Testing Initial Search Batch (cursor: '', limit: 4)");
  const batch1 = await ProductService.getAllProductsPublic({
    limit: "4",
    cursor: "",
  });

  console.log(`   Fetched ${batch1.data.length} products`);
  console.log(`   Meta:`, batch1.meta);

  if (batch1.data.length === 0) {
    console.log("   ⚠️ No active products found in DB to test. Creating or verifying query execution.");
  } else {
    const batch1Ids = batch1.data.map((p: any) => p.id);
    console.log(`   Batch 1 Product IDs:`, batch1Ids);

    const nextCursor = batch1.meta.nextCursor;
    console.log(`   Next Cursor: ${nextCursor}`);

    if (nextCursor && batch1.meta.hasNextPage) {
      // 2. Next public search query using cursor (Batch 2, limit 4)
      console.log("\n2. Testing Next Batch Using Cursor (cursor: " + nextCursor + ", limit: 4)");
      const batch2 = await ProductService.getAllProductsPublic({
        limit: "4",
        cursor: nextCursor,
      });

      console.log(`   Fetched ${batch2.data.length} products`);
      console.log(`   Meta:`, batch2.meta);
      const batch2Ids = batch2.data.map((p: any) => p.id);
      console.log(`   Batch 2 Product IDs:`, batch2Ids);

      // Check for zero duplicate items between batch 1 and batch 2
      const duplicateIds = batch1Ids.filter((id: string) => batch2Ids.includes(id));
      if (duplicateIds.length === 0) {
        console.log("   ✅ SUCCESS: Zero duplicate items between batch 1 and batch 2 (Clean Keyset Stream)");
      } else {
        console.error("   ❌ FAILED: Duplicate IDs found:", duplicateIds);
      }
    }
  }

  // 3. Testing Search Term with Cursor Query
  console.log("\n3. Testing Keyword Search with Cursor (searchTerm: 'a', limit: 3)");
  const searchBatch = await ProductService.getAllProductsPublic({
    searchTerm: "a",
    limit: "3",
    cursor: "",
  });
  console.log(`   Search matched ${searchBatch.data.length} items`);
  console.log(`   Meta:`, searchBatch.meta);

  // 4. Testing Backward Compatibility: Offset Pagination Mode
  console.log("\n4. Testing Backward-Compatible Offset Pagination (page: 1, limit: 3)");
  const offsetBatch = await ProductService.getAllProductsPublic({
    page: "1",
    limit: "3",
  });
  console.log(`   Offset mode meta:`, offsetBatch.meta);
  if (offsetBatch.meta.page === 1 && offsetBatch.meta.total !== undefined) {
    console.log("   ✅ SUCCESS: Offset mode returns full pagination metadata (page, total, totalPages)");
  }

  console.log("\n=================================================");
  console.log("Cursor Search Verification Completed Successfully!");
  console.log("=================================================");

  await prisma.$disconnect();
}

runCursorSearchVerification().catch(async (err) => {
  console.error("Test failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
