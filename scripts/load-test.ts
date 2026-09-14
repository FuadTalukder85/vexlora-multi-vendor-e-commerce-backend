import autocannon from "autocannon";

/**
 * Express Server Load Test & Benchmarking Script
 * Simulates user requests against the backend server.
 *
 * Usage:
 *   1. Ensure server is running (`pnpm dev` or `pnpm start`)
 *   2. Run script: `pnpm test:load`
 */

const TARGET_URL = process.env.TARGET_URL || "http://localhost:5000/api/v1/products";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "10", 10); // Default to 10 matching DB connection pool
const DURATION = parseInt(process.env.DURATION || "15", 10); // 15 seconds
const REQUEST_TIMEOUT = parseInt(process.env.TIMEOUT || "30", 10); // 30 seconds

async function runLoadTest() {
  console.log(`\n🔍 Checking server connectivity at: ${TARGET_URL}...`);

  // 1. Health-check target server before launching heavy load test
  try {
    const res = await fetch(TARGET_URL);
    console.log(`✅ Server is ONLINE (Status: ${res.status} ${res.statusText})\n`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ ERROR: Server is NOT reachable at ${TARGET_URL}`);
    console.error(`   Reason: ${errorMsg}`);
    console.error(`\n👉 Please start your Express server first in another terminal tab:`);
    console.error(`   $ pnpm dev\n`);
    process.exit(1);
  }

  console.log(`🔥 Starting High-Concurrency Load Test`);
  console.log(`- Target Endpoint:       ${TARGET_URL}`);
  console.log(`- Concurrent Connections: ${CONCURRENCY.toLocaleString()}`);
  console.log(`- Test Duration:         ${DURATION} seconds`);
  console.log(`- Timeout per request:   ${REQUEST_TIMEOUT} seconds\n`);

  const instance = autocannon(
    {
      url: TARGET_URL,
      connections: CONCURRENCY,
      duration: DURATION,
      timeout: REQUEST_TIMEOUT,
      headers: {
        "content-type": "application/json",
      },
    },
    (err, result) => {
      if (err) {
        console.error("❌ Load test failed:", err);
        return;
      }

      console.log("\n📊 Load Test Results:");
      console.log("-----------------------------------------");
      console.log(`- Total Requests Sent:   ${result.requests.total.toLocaleString()}`);
      console.log(`- Requests / Sec (RPS):  ${result.requests.average.toLocaleString()} avg`);
      console.log(`- Throughput:            ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
      console.log(`- 2xx Success Responses: ${result["2xx"].toLocaleString()}`);
      console.log(`- Non-2xx Responses:     ${(result.non2xx || 0).toLocaleString()}`);
      console.log(`- Timeouts/Errors:       ${result.errors.toLocaleString()}`);
      console.log("-----------------------------------------");
      console.log(`- Latency (Average):     ${result.latency.average} ms`);
      console.log(`- Latency (p50):         ${result.latency.p50} ms`);
      console.log(`- Latency (p97.5):       ${result.latency.p97_5} ms`);
      console.log(`- Latency (p99):         ${result.latency.p99} ms`);
      console.log("-----------------------------------------");
    },
  );

  autocannon.track(instance, { renderProgressBar: true });
}

runLoadTest();
