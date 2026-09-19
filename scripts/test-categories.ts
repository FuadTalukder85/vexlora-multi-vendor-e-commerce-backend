import { ProductService } from "../src/app/modules/product/product.service";
import { prisma } from "../src/app/lib/prisma";

async function testCategorySearch() {
  console.log("Testing Category Slug Search: laptops-computers");

  const result1 = await ProductService.getAllProductsPublic({
    category: "laptops-computers",
    limit: "5",
  });

  console.log("Result for 'laptops-computers':");
  console.log(`  Fetched: ${result1.data.length} products`);
  console.log(`  Meta:`, result1.meta);
  if (result1.data.length > 0) {
    console.log(`  Sample product:`, (result1.data[0] as any).title, `Category:`, (result1.data[0] as any).category?.name);
  }

  console.log("\nTesting Parent Category Slug Search: electronics");
  const result2 = await ProductService.getAllProductsPublic({
    category: "electronics",
    limit: "5",
  });

  console.log("Result for 'electronics':");
  console.log(`  Fetched: ${result2.data.length} products`);
  console.log(`  Meta:`, result2.meta);

  await prisma.$disconnect();
}

testCategorySearch().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
