# arda 数据架构 · Schema 详细设计（arda-data-architecture-schema）

> 状态：详细设计（跟随业务需求随时调整；变更须同步 `prisma/schema.prisma` 与本文件）
> 范围：数据库 / schema / 表 / 全部字段 / 索引 / 约束 / 触发器 —— **可据此建库**的详细参照
> 唯一 SoT：`portals/app/prisma/schema.prisma`（本文件是其可读导览，字段名/类型以 schema 文件为准）
> 顶层设计与目标见 [`arda-data-architecture.md`](arda-data-architecture.md)；迁移现状见 [`arda-data-architecture-migration.md`](arda-data-architecture-migration.md)

---

## 1. 数据库 / 客户端配置

| 项 | 取值 |
|---|---|
| `generator client` | `provider = "prisma-client"`（Prisma 7，Rust-free：queryCompiler + driver adapter） |
| 生成产物 | `output = "../generated/prisma"` → `portals/app/generated/prisma/`（**git-ignored**，build / `prisma generate` 时产出） |
| `datasource db` | `provider = "postgresql"` |
| 连接串 | `DATABASE_URL` 环境变量（每栈独立，compose 注入） |
| 驱动适配器 | `@prisma/adapter-pg`，`new PrismaPg({ connectionString: process.env.DATABASE_URL })` |
| 客户端单例 | `portals/app/app/lib/db.ts` 导出 `prisma`；`globalThis.prisma` 复用（dev 热重载防连接耗尽），仅非 production 挂载 |
| 触发器 | **无**（当前 schema 不使用数据库触发器；派生值走应用层计算，见 `arda-data-architecture.md` §5「有意不落库」） |

```ts
// app/lib/db.ts（权威实现，勿在此外重复实例化 PrismaClient）
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });
```

---

## 2. 枚举

```prisma
enum AssetLevel {
  public
  internal
  sensitive
  core
}

enum QualityStatus {
  pass
  warn
  fail
}
```

---

## 3. workspace 隔离：字段与索引约定

适用于**全部**带 `workspaceId` 的表（下称"业务表"）：

- `workspaceId String`：普通列，**无 FK**（workspace 生命周期归平台，业务行不依赖本地 `WorkspaceRef` 先存在）。
- 每表至少一条 `@@index([workspaceId])`。
- 展示编码（`code`/`name`/`term`）唯一性一律加 `workspaceId` 前缀：`@@unique([workspaceId, code])`。
- 热点查询叠加复合索引，如 `Dataset` 的 `@@index([workspaceId, domain])`、`AuditLog` 的 `@@index([workspaceId, createdAt])`。

代码范式（服务端强制过滤，客户端组件不直连数据库）：
```ts
// (app)/catalog/data.ts
export async function getCatalogAsset(workspaceId: string, id: string) {
  return prisma.dataset.findFirst({ where: { workspaceId, id } });   // 复合过滤，防跨 workspace
}
// (app)/dashboard/data.ts —— 聚合/分组同样逐一 scope
prisma.dataset.groupBy({ by: ["domain"], where: { workspaceId }, _count: { _all: true } });
```

`workspaceId` 取值链路：`identity.active_workspace`（OIDC claim）→ Redis 会话 → `getSession().workspaceId`（`auth/lib/session.ts`）。

---

## 4. 表详细设计

### 4.1 assets — 数据资产

```prisma
model Dataset {
  id             String      @id @default(cuid())
  workspaceId    String
  dataSourceId   String?
  name           String
  code           String                              // 技术 slug，如 dw_customer_master
  description    String?
  domain         String?                             // 主题域 facet（自由键，产品定义）
  team           String?                              // 归属团队 facet
  refreshFreq    String?                              // realtime | daily | weekly | monthly
  type           String                               // table | view | file | stream
  location       String?
  rowCountEst    BigInt?
  sizeBytes      BigInt?
  ownerUserId    String?
  classification AssetLevel  @default(internal)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  source         DataSource?          @relation(fields: [dataSourceId], references: [id], onDelete: SetNull)
  tags           DatasetTag[]
  qualityRules   QualityRule[]
  qualityResults QualityResult[]
  lineageOut     LineageEdge[]        @relation("LineageUpstream")
  lineageIn      LineageEdge[]        @relation("LineageDownstream")
  services       DataServiceDataset[]

  @@unique([workspaceId, code])
  @@index([workspaceId])
  @@index([workspaceId, dataSourceId])
  @@index([workspaceId, domain])
}
```
> 质量总分 / 订阅数**不落此表**（派生值，见顶层设计 §5）。`connectionConfig` 类字段一律 `Json?`，敏感值由应用层加密后写入。

```prisma
model Tag {
  id          String       @id @default(cuid())
  workspaceId String
  name        String
  color       String?
  datasets    DatasetTag[]

  @@unique([workspaceId, name])
  @@index([workspaceId])
}

model DatasetTag {
  datasetId   String
  tagId       String
  workspaceId String

  dataset Dataset @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([datasetId, tagId])
  @@index([workspaceId])
}

model GlossaryTerm {
  id            String  @id @default(cuid())
  workspaceId   String
  term          String
  definition    String
  stewardUserId String?

  @@unique([workspaceId, term])
  @@index([workspaceId])
}
```

### 4.2 integration — 集成（v1 仅登记，不做数据搬运）

```prisma
model DataSource {
  id               String    @id @default(cuid())
  workspaceId      String
  name             String
  type             String    // postgres | s3 | bigquery | rest | file | ...
  connectionConfig Json?     // 应用层加密后落库
  status           String    @default("connected")
  lastSyncedAt     DateTime?
  createdAt        DateTime  @default(now())

  datasets Dataset[]

  @@index([workspaceId])
}
```
> `future`（保留定义，不建表）：`Pipeline`（同步/变换定义）、`JobRun`（一次执行记录）。

### 4.3 governance — 治理（数据集级）

```prisma
model Policy {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  type        String   // access | masking | retention | classification
  scope       String   // dataset | tag | source
  config      Json?
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([workspaceId])
}

model QualityRule {
  id          String   @id @default(cuid())
  workspaceId String
  datasetId   String
  code        String   // 展示 id，如 Q-201
  name        String
  dimension   String   // 质量维度键：completeness | accuracy | ...
  type        String   // not_null | unique | range | freshness | ...
  config      Json?
  severity    String   @default("warning")
  enabled     Boolean  @default(true)

  dataset Dataset         @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  results QualityResult[]

  @@unique([workspaceId, code])
  @@index([workspaceId])
  @@index([datasetId])
}

model QualityResult {
  id          String        @id @default(cuid())
  workspaceId String
  ruleId      String
  datasetId   String
  runAt       DateTime      @default(now())
  status      QualityStatus
  score       Float?        // 通过率 %
  issues      Int           @default(0)
  details     Json?

  rule    QualityRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  dataset Dataset     @relation(fields: [datasetId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([ruleId])
  @@index([datasetId])
}

model Standard {
  id          String   @id @default(cuid())
  workspaceId String
  code        String   // 如 STD-001
  name        String
  type        String   // code-set | data-element
  ref         String   // 参照规范，如 ISO 3166-1
  items       Int      @default(0)
  usage       Int      @default(0)
  status      String   @default("draft") // published | draft | review
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([workspaceId, code])
  @@index([workspaceId])
}

model LineageEdge {
  id                  String  @id @default(cuid())
  workspaceId         String
  upstreamDatasetId   String
  downstreamDatasetId String
  transform           String?
  jobId                String?

  upstream   Dataset @relation("LineageUpstream", fields: [upstreamDatasetId], references: [id], onDelete: Cascade)
  downstream Dataset @relation("LineageDownstream", fields: [downstreamDatasetId], references: [id], onDelete: Cascade)

  @@unique([upstreamDatasetId, downstreamDatasetId])
  @@index([workspaceId])
}
```
> `future`（保留定义，不建表）：列级 `Field`（列级 schema，含类型/可空/分级/位置）。

### 4.4 services — 数据服务

```prisma
model DataService {
  id          String     @id @default(cuid())
  workspaceId String
  code        String     // 如 API-1042
  name        String
  path        String     // 如 /api/v2/customer/verify
  method      String     @default("GET") // GET | POST
  description String?
  domain      String?
  level       AssetLevel @default(internal)
  type        String     // rest_api | query | export | share
  config      Json?
  status      String     @default("draft") // draft | running | review | paused
  publishedAt DateTime?
  createdAt   DateTime   @default(now())

  datasets DataServiceDataset[]
  apiKeys  ApiKey[]

  @@unique([workspaceId, code])
  @@index([workspaceId])
}

model DataServiceDataset {
  dataServiceId String
  datasetId     String
  workspaceId   String

  service DataService @relation(fields: [dataServiceId], references: [id], onDelete: Cascade)
  dataset Dataset     @relation(fields: [datasetId], references: [id], onDelete: Cascade)

  @@id([dataServiceId, datasetId])
  @@index([workspaceId])
}
```

### 4.5 admin — 密钥与审计

```prisma
model ApiKey {
  id            String    @id @default(cuid())
  workspaceId   String
  dataServiceId String?
  name          String
  hashedKey     String    @unique   // 仅存哈希，不存明文
  scopes        String[]
  lastUsedAt    DateTime?
  revoked       Boolean   @default(false)
  createdAt     DateTime  @default(now())

  service DataService? @relation(fields: [dataServiceId], references: [id], onDelete: SetNull)

  @@index([workspaceId])
}

model AuditLog {
  id             String   @id @default(cuid())
  workspaceId    String
  actor          String   // 用户 id 或 "platform"
  action         String
  target         String?
  idempotencyKey String?  @unique   // 幂等防重放（承载 ADR §5.1 平台指令审计）
  metadata       Json?
  createdAt      DateTime @default(now())

  @@index([workspaceId])
  @@index([workspaceId, createdAt])
}
```

### 4.6 infrastructure — 非用户业务数据

```prisma
model WorkspaceRef {
  id         String   @id           // = 平台/IdP 的 active_workspace
  orgId      String
  seedStatus String?                 // 平台标记：需要示例数据填充（ADR §4）
  createdAt  DateTime @default(now())

  @@index([orgId])
}

model SeedTemplate {
  id        String            @id @default(cuid())
  name      String
  createdAt DateTime          @default(now())
  versions  TemplateVersion[]
}

model TemplateVersion {
  id         String       @id @default(cuid())
  templateId String
  version    String
  manifest   Json
  createdAt  DateTime     @default(now())

  template SeedTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, version])
}
```
> `WorkspaceRef` 无 `workspaceId` 索引（它本身就是隔离锚，`id` 即 workspace 标识）；`SeedTemplate` / `TemplateVersion` 全局共享，非 workspace 隔离。

---

## 5. 索引一览（速查）

| 表 | 索引 / 唯一约束 |
|---|---|
| Dataset | `@@unique([workspaceId, code])`；`@@index([workspaceId])`；`@@index([workspaceId, dataSourceId])`；`@@index([workspaceId, domain])` |
| Tag | `@@unique([workspaceId, name])`；`@@index([workspaceId])` |
| DatasetTag | `@@id([datasetId, tagId])`；`@@index([workspaceId])` |
| GlossaryTerm | `@@unique([workspaceId, term])`；`@@index([workspaceId])` |
| DataSource | `@@index([workspaceId])` |
| Policy | `@@index([workspaceId])` |
| QualityRule | `@@unique([workspaceId, code])`；`@@index([workspaceId])`；`@@index([datasetId])` |
| QualityResult | `@@index([workspaceId])`；`@@index([ruleId])`；`@@index([datasetId])` |
| Standard | `@@unique([workspaceId, code])`；`@@index([workspaceId])` |
| LineageEdge | `@@unique([upstreamDatasetId, downstreamDatasetId])`；`@@index([workspaceId])` |
| DataService | `@@unique([workspaceId, code])`；`@@index([workspaceId])` |
| DataServiceDataset | `@@id([dataServiceId, datasetId])`；`@@index([workspaceId])` |
| ApiKey | `@unique` on `hashedKey`；`@@index([workspaceId])` |
| AuditLog | `@unique` on `idempotencyKey`；`@@index([workspaceId])`；`@@index([workspaceId, createdAt])` |
| WorkspaceRef | `@@index([orgId])` |
| TemplateVersion | `@@unique([templateId, version])` |

---

## 6. 变更规程

1. 改 `portals/app/prisma/schema.prisma`。
2. `prisma migrate dev --name <desc>` 生成迁移（本地/CI），产物入 `prisma/migrations/`。
3. 同步更新本文件对应表定义（字段/索引变化）。
4. 若新增/删除表或改变隔离方式，同步更新 [`arda-data-architecture.md`](arda-data-architecture.md) §5 总览表。
5. 迁移在部署环境的应用方式、当前迭代目标见 [`arda-data-architecture-migration.md`](arda-data-architecture-migration.md)。
