# arda 数据架构（arda-data-architecture）— 顶层权威设计

> 状态：权威设计（较稳定演进；字段级细节见 [`arda-data-architecture-schema.md`](arda-data-architecture-schema.md)；
> 现状/迁移进度见 [`arda-data-architecture-migration.md`](arda-data-architecture-migration.md)）
> 范围：arda 产品侧**业务领域数据**的持久层 —— 定位、目标、约束、总体模型
> 上游依据：[`ADR-entitlement-and-workspace.md`](../ADR-entitlement-and-workspace.md)（§1.7 SoR 分工、§4 模板、§5 指令、§8 落地清单）、
> [`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md)（领域实体目录 v1）

---

## 0. 定位与边界（先读）

arda 的持久层**只为领域业务数据存在**，不承载身份 / 订阅 / 计费。数据所有权边界（ADR §1.7）：

| 归属 | 内容 | 落在哪 |
|---|---|---|
| **产品侧（arda）** | 数据资产 / 元数据 / 治理 / 服务等业务数据 | **arda 自己的 Postgres** |
| 平台侧（vxture） | 订阅 / 权益 / 计费 / 授权、Org 与 workspace 生命周期 | vxture 平台，arda **不建表** |
| 身份层（IdP） | 账号、`active_org` / `active_workspace` | accounts.vxture.com（OIDC claim） |

两侧仅通过两个契约耦合：**`workspaceId` 隔离键** + **`(workspace, product=arda)` 订阅行**（订阅行在平台侧，见 [`entitlement.md`](entitlement.md) 与 [平台对接要求](../workplan/vxture-platform-integration-requirements.md)）。

> 净结论：引入持久层的真正驱动力是**领域数据**（而非权益）。权益走 token claim / 未来实时拉取，**arda 侧不落 Subscription 镜像表**（详见 §5）。

---

## 1. 设计目标

1. **单一产品数据面**：一套 schema、一套 Postgres 服务，按 `workspaceId` 做多租户隔离，而非按环境（beta/prod）拆库。
2. **不越权持有平台数据**：不建 Subscription / Org / workspace 生命周期表；这些只读取（token claim 或未来的平台端点）。
3. **catalog-first，渐进扩展**：v1 只做「资产目录 + 元数据 + 治理」；集成的数据搬运（Pipeline/JobRun）与列级治理（Field）明确标记 `future`，保留定义、不提前建表。
4. **可推导优于可存储**：能从其他表算出的值（质量总分、订阅数、时序/telemetry）不落库，避免配置漂移与刷新一致性问题。
5. **平台指令可安全执行**：接收平台 `seed / wipe / invalidate` 指令的能力（幂等、审计）是一等设计目标，而非事后补丁。

---

## 2. 技术栈（总览）

| 组件 | 取值 |
|---|---|
| ORM | Prisma 7（Rust-free：queryCompiler + driver adapter） |
| 数据库 | PostgreSQL 16 |
| 驱动适配器 | `@prisma/adapter-pg`（node-postgres） |
| 客户端实例 | 单例（`app/lib/db.ts`，`globalThis` 复用，避免连接耗尽） |
| Redis 角色 | 仅会话 / 令牌（`authreq` / `rpsess` / `rptok` / `sid`），**不做数据缓存** |

字段级 / 生成配置 / 连接串细节见 [`arda-data-architecture-schema.md`](arda-data-architecture-schema.md) §1。

---

## 3. 运行时拓扑（总览）

一镜像、两栈（beta/prod）、每栈三服务，**运行态不共享**：

```
   arda-app（无状态 Next.js）
      ├─ REDIS_URL    → arda-redis  （会话/令牌）
      └─ DATABASE_URL → arda-db     （领域业务数据, Postgres 16）
```

- 每栈独立数据目录（prod `/srv/md0/arda/data`、beta `/srv/md1/arda-beta/data`），两栈的 `.env` / 数据目录**绝不互指**。
- 部署细节（compose 服务定义、启动迁移方式、备份）见 [`arda-data-architecture-migration.md`](arda-data-architecture-migration.md) §3。

---

## 4. workspace 隔离模型（核心约束）

**隔离键 = `workspaceId`**，等于平台 / IdP 的 `active_workspace`。这是贯穿整个 schema 的硬约束：

1. **取值链路**：OIDC token claim（`active_workspace`）→ Redis 会话 → `getSession().workspaceId`。
2. **强制过滤**：所有领域实体查询在服务端按 `where: { workspaceId }` 收口；客户端组件不直连数据库。
3. **Schema 层约束**：
   - 每个业务实体都带 `workspaceId`，且是**普通索引列，不是外键** —— workspace 生命周期归平台，业务行不能依赖本地 `WorkspaceRef` 先存在。
   - 业务唯一性一律 workspace 内唯一（如 `@@unique([workspaceId, code])`），而非全局唯一。
   - 每个实体至少 `@@index([workspaceId])`；热点查询叠加复合索引。
4. **上下文切换免重认证**：org/workspace 切换是应用内动作 —— 重新按新 `workspaceId` 查询，而非重新走 OIDC（ADR §3.4）。

代码范式与字段级索引见 [`arda-data-architecture-schema.md`](arda-data-architecture-schema.md) §3。

---

## 5. 领域数据模型（总览：所有表）

按导航分区（assets / integration / governance / services / admin / infra）。完整字段/索引见 schema 文件；这里只列**表与其核心用途 + 关键字段**。

**枚举**：`AssetLevel { public | internal | sensitive | core }`、`QualityStatus { pass | warn | fail }`。

| 分区 | 表 | ws? | 核心用途 | 关键字段 |
|---|---|---|---|---|
| assets | **Dataset** | ✓ | 核心数据资产 | `code`（ws 内唯一）、`domain`/`team`/`refreshFreq`、`classification` |
| assets | **Tag** / **DatasetTag** | ✓ | 标签 + M:N 关联 | `name`（ws 内唯一） |
| assets | **GlossaryTerm** | ✓ | 业务术语表 | `term`（ws 内唯一）、`definition` |
| integration | **DataSource** | ✓ | 外部系统登记 + 元数据拉取（v1 不搬数据） | `type`、`connectionConfig`（应用层加密） |
| governance | **Policy** | ✓ | 访问 / 脱敏 / 留存 / 分级规则 | `type`、`scope` |
| governance | **QualityRule** / **QualityResult** | ✓ | 稽核规则 + 结果 | `dimension`、`status`（QualityStatus）、`score` |
| governance | **Standard** | ✓ | 数据标准（代码集/数据元） | `type`、`ref`、`status` |
| governance | **LineageEdge** | ✓ | 数据集级血缘 | `upstreamDatasetId` → `downstreamDatasetId` |
| services | **DataService** / **DataServiceDataset** | ✓ | 数据服务（API）+ 与 Dataset 的 M:N | `method`、`status`、`level` |
| admin | **ApiKey** | ✓ | 服务密钥（存哈希） | `hashedKey`（全局唯一）、`scopes`、`revoked` |
| admin | **AuditLog** | ✓ | 活动 + 平台指令审计 | `idempotencyKey`（全局唯一，幂等防重放） |
| infra | **WorkspaceRef** | — | 平台 workspace 的本地镜像（隔离锚，非生命周期所有者） | `id` = 平台 `active_workspace`、`seedStatus` |
| infra | **SeedTemplate** / **TemplateVersion** | — | 全局只读版本化示例数据模板 | `manifest`（Json） |

**有意不落库**（避免配置漂移 / 尚无数据来源）：
- `Dataset` 的**质量总分**与**订阅数** —— 派生自 `QualityResult` 聚合 / 订阅 join，算不出时 UI 显示 `-`。
- 仪表盘的增长趋势 / 调用量 / 告警 —— 客户端展示聚合（telemetry/timeseries v1 未建模）。

**v1 有意不建模**（`future`，见领域目录）：列级 `Field`、集成的 `Pipeline` / `JobRun`。

---

## 6. 边界：arda 不落的表

| 概念 | 实际来源 | arda 是否建表 |
|---|---|---|
| 订阅 state / tier / had_trial | OIDC token 的 `arda` claim | **否**（直接从 claim 求值） |
| Subscription（按 workspace×product） | vxture 平台（唯一 SoT） | **否** |
| Org / workspace 生命周期 | 平台 | **否**（仅 `WorkspaceRef` 镜像） |
| 计费 / 授权 | 平台 | **否** |

目标态（ADR §3.5）：tier 由 token claim 迁移为**平台只读端点实时拉取 + Redis 短 TTL 缓存 + invalidate 失效通知**，仍**不建镜像表**。当前实现状态见 [`arda-data-architecture-migration.md`](arda-data-architecture-migration.md)。

---

## 7. 文档导航

| 需要什么 | 看哪个文件 |
|---|---|
| 目标 / 约束 / 总体模型（本文件） | `arda-data-architecture.md` |
| 每张表的完整字段 / 索引 / 触发器 / 可据此建库的详细设计 | [`arda-data-architecture-schema.md`](arda-data-architecture-schema.md) |
| 迁移时间线、现状 vs 目标态、演进路线 | [`arda-data-architecture-migration.md`](arda-data-architecture-migration.md) |
