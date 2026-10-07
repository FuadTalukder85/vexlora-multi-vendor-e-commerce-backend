# 🏗️ System Architecture: Production-Grade Multi-Vendor E-Commerce Platform

This document outlines the end-to-end system architecture, design patterns, data flow, and scaling strategies for the **Multi-Vendor E-Commerce Backend**.

> [!TIP]
> 🎨 **Interactive Architecture Diagram**:
> - ✏️ **[Download Editable Draw.io File (Google Drive)](https://drive.google.com/file/d/14d68AaZ_GSTuUge-DTK02I8edDlXh4qj/view?usp=sharing)**
> 
> **How to use in Draw.io:**
> 1. Download the diagram from Google Drive.
> 2. Open **[app.diagrams.net](https://app.diagrams.net/)**.
> 3. Click **Open Existing Diagram** (or drag & drop the downloaded file) to view, edit, or export as PNG/PDF/SVG.


---


## 1. High-Level System Topology

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'darkMode': true, 'background': '#0d1117', 'mainBkg': '#161b22', 'nodeBorder': '#30363d', 'lineColor': '#8b949e', 'textColor': '#ffffff', 'fontFamily': 'ui-sans-serif, system-ui, sans-serif' }}}%%
flowchart TD
    Client["Clients (Next.js Storefront / Vendor Portal / Admin Console / Mobile)"]
    
    API["Express 5 API – /api/v1 (Modular Monolith)<br/>TypeScript • Better-Auth Session Middleware • Fingerprint Extractor • Zod Validation"]

    subgraph Modules["Domain Modules (Modular Monolith)"]
        AuthMod["Auth & User Module<br/>Better-Auth + RBAC<br/>(CUSTOMER, VENDOR, ADMIN)"]
        VendorMod["Vendor & Payout Module<br/>Profiles + Storefront<br/>Commissions & Payouts"]
        CatalogMod["1M+ Product Catalog<br/>Products + Variants + Category<br/>Deals + Sub-20ms Cache"]
        CartMod["Cart & Wishlist<br/>Multi-Vendor Cart Splitting<br/>Saved Wishlist"]
        OrdersMod["Multi-Vendor Order Module<br/>Checkout ➔ Master Order<br/>Split into Isolated SubOrders"]
        PaymentsMod["Payment & Stripe Module<br/>Stripe PaymentIntents +<br/>Idempotent Webhooks"]
        FraudMod["Fraud & Risk Engine<br/>Device Fingerprinting +<br/>Sybil Reviews + Coupon Abuse"]
        AIMod["AI Image Search Module<br/>Vector Embeddings +<br/>pgvector Cosine Search"]
    end

    Redis[("Redis 7 (IORedis)<br/>• Sub-20ms Catalog Cache<br/>• DB Fallback & Rate Limiter<br/>• Pattern Invalidation")]

    Prisma["PrismaService (@prisma/adapter-pg)"]
    Storage["Cloudinary Storage Module"]

    Postgres[("PostgreSQL 17<br/>• ACID Transactions<br/>• 1M+ Composite Indexes<br/>• pgvector Embeddings")]
    Cloudinary[("Cloudinary CDN<br/>Product Images & Media Assets")]

    %% Connectors
    Client --> API
    
    API --> AuthMod
    API --> VendorMod
    API --> CatalogMod
    API --> CartMod
    API --> OrdersMod
    API --> PaymentsMod
    API --> FraudMod
    API --> AIMod
    CatalogMod -.->|"Sub-20ms Cache & Rate Limit"| Redis

    AuthMod --> Prisma
    VendorMod --> Prisma
    CatalogMod --> Prisma
    CatalogMod --> Storage
    CartMod --> Prisma
    OrdersMod --> Prisma
    PaymentsMod --> Prisma
    FraudMod --> Prisma
    AIMod --> Prisma

    Prisma --> Postgres
    Storage --> Cloudinary
```




---

## 2. Core Architectural Highlights

### A. Multi-Vendor Order Splitting & Escrow Pipeline
When a customer purchases products across multiple independent vendors in a single checkout:
1. **Master Order Creation**: An umbrella transaction is generated for the customer.
2. **Sub-Order Decomposition**: The order is decomposed into isolated `sub_orders` by `vendor_id`.
3. **Escrow & Commission Calculation**: Platform commission and vendor payout ledgers are calculated at the line-item level.
4. **Idempotent Webhooks**: Stripe webhook handling guarantees that payments are only credited once through event-id deduplication.
5. **Real-time Dispatch**: Socket.IO triggers push events directly to each vendor's private room.

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant API as Order Service
    participant Stripe as Stripe Gateway
    participant DB as PostgreSQL
    participant Socket as Socket.IO
    actor VendorA as Vendor A
    actor VendorB as Vendor B

    Customer->>API: POST /orders (Items from Vendor A + Vendor B)
    API->>DB: Begin ACID Transaction
    API->>DB: Verify Stock & Apply Validated Coupon
    API->>DB: Create Master Order (PENDING)
    API->>DB: Split into SubOrder A (Vendor A) & SubOrder B (Vendor B)
    API->>Stripe: Create PaymentIntent (w/ Metadata & Idempotency Key)
    DB-->>API: Commit Transaction
    API-->>Customer: Return Client Secret
    
    Customer->>Stripe: Complete Payment
    Stripe->>API: Webhook (checkout.session.completed)
    API->>DB: Mark Master Order & SubOrders as PAID
    API->>DB: Generate Pending Payout Records (Commissions Deducted)
    API->>Socket: Emit order:new to Vendor A & Vendor B rooms
    Socket-->>VendorA: Real-time Alert
    Socket-->>VendorB: Real-time Alert
```

---

### B. High-Performance Redis Caching & Invalidation Layer
* **Performance Gain**: Product queries drop from **~1,800ms to <20ms**.
* **Zero-Downtime Fallback**: If Redis becomes unavailable, the system automatically falls back to PostgreSQL without interrupting user traffic.
* **Targeted Invalidation**: Invalidation occurs via key pattern matching (`products:public:*`) immediately upon write operations (create, update, delete, stock change).

```mermaid
flowchart TD
    Req["Product Catalog Request"] --> Redis{"Check Redis Cache"}
    Redis -->|"Cache Hit (<20ms)"| ReturnCached["Return Cached JSON"]
    Redis -->|"Cache Miss / Redis Down"| QueryDB["Query PostgreSQL (Prisma)"]
    QueryDB --> SetCache["Store in Redis (TTL: 1 Hour)"]
    SetCache --> ReturnData["Return Fresh Response"]
    
    Mutate["Product Mutated (Update/Delete/Stock Change)"] --> Invalidate["Purge Pattern: products:public:*"]
    Invalidate --> DBWrite["Commit DB Write"]
```

---

### C. Advanced Risk & Fraud Detection Engine
Prevents voucher abuse, fake review rings (Sybil attacks), and fraudulent multi-accounting:
* **Device Fingerprinting**: Aggregates browser canvas, screen resolution, IP, and hardware markers to detect multiple accounts on one physical machine.
* **Review Verification**: Reviews can only be submitted by verified buyers of the exact sub-order.
* **Coupon Abuse Guard**: Atomic coupon usage checks prevent race conditions during flash sales.

```mermaid
flowchart LR
    Request["Action: Checkout / Review / Coupon"] --> FP["Device Fingerprint Engine"]
    FP --> Rules["Fraud Rule Evaluation"]
    Rules --> Score["Calculate Composite Risk Score (0 - 100)"]
    Score --> Decision{"Score > 75?"}
    Decision -->|"Yes (High Risk)"| Block["Reject Action + Log FraudAudit"]
    Decision -->|"Medium (50-75)"| Flag["Allow with Flag for Admin Review"]
    Decision -->|"Low (<50)"| Approve["Approve Action"]
```

---

### D. AI Vector Image Search
* **Visual Search**: Generates vector embeddings for product images.
* **Similarity Search**: Performs cosine-distance similarity queries via PostgreSQL vector indexing to allow buyers to find products via image upload.

---

## 3. Layered Modular Architecture

The application is structured into decoupled domain modules following clean separation of concerns:

```
src/
├── app.ts                         # Express app setup, security middlewares, route mounting
├── server.ts                      # Cluster/server lifecycle & graceful shutdown
└── app/
    ├── config/                    # Environment, Stripe, Redis & Cloudinary configs
    ├── errors/                    # Global AppError, Zod & Prisma error formatting
    ├── lib/                       # Prisma client, Better-Auth, Redis client, Nodemailer
    ├── middlewares/               # Auth, RBAC, Rate-limiting, Fingerprinting, Validation
    ├── modules/                   # 20+ Domain Feature Modules
    │   └── {domain}/
    │       ├── {domain}.controller.ts   # HTTP Request/Response handling
    │       ├── {domain}.service.ts      # Core business logic & database transactions
    │       ├── {domain}.route.ts        # Route definitions with middlewares
    │       ├── {domain}.validation.ts   # Zod input schemas
    │       └── {domain}.types.ts        # TypeScript typings
    ├── routes/                    # Versioned route aggregator (/api/v1)
    ├── shared/                    # catchAsync, sendResponse, QueryBuilder
    ├── templates/                 # EJS HTML email templates
    └── utils/                     # Logger, cookie helpers, formatting utilities
```

---

## 4. Scalability, Security & Production Checklist

| Category | Implementation |
| :--- | :--- |
| **Authentication & RBAC** | Better-Auth session cookies with `CUSTOMER`, `VENDOR`, `ADMIN`, `SUPER_ADMIN` roles |
| **Database Performance** | B-Tree & composite indexes on high-cardinality search columns; 1M+ seed tested |
| **High Concurrency** | Load-tested with Autocannon (1,400+ concurrent req/sec with 0 errors) |
| **Input Validation** | Strict Zod validation on request parameters, queries, and bodies |
| **Error Handling** | Standardized JSON envelope: `{ success, statusCode, message, meta, data }` |
| **Graceful Shutdown** | Intercepts `SIGTERM`/`SIGINT` to close database pools and WebSocket connections safely |
