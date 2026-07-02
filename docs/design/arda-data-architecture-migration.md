# arda 数据架构 · 迁移与现状（arda-data-architecture-migration）

> 状态：实时跟踪（随每次迭代更新；这是"现在在哪、要去哪"的文件，不是稳定设计）
> 范围：schema 迁移时间线、部署时的迁移执行方式、当前实现 vs 目标态的差距、文档漂移、演进路线
> 顶层设计见 [`arda-data-architecture.md`](arda-data-architecture.md)；字段级详情见 [`arda-data-architecture-schema.md`](arda-data-architecture-schema.md)

---

## 1. 迁移时间线（schema 版本）

`portals/app/prisma/migrations/`，部署时容器启动自动 `prisma migrate deploy` 应用。

| 迁移 | 内容 |
|---|---|
| `0001_init` | 全部核心表 + 2 枚举 + FK + 索引（首次建库） |
| `0002_catalog_fields` | `Dataset` 加 `code/description/domain/refreshFreq/team` + `(workspaceId, code)` 唯一 + `[workspaceId, domain]` 索引 |
| `0003_standards` | 新增 `Standard` 表 |
| `0004_quality_fields` | `QualityRule` 加 `code/name/dimension` + 唯一；`QualityResult` 加 `issues` |
| `0005_service_fields` | `DataService` 加 `code/name/path/method/description/domain/level` + 唯一 |

**当前 schema 版本：`0005_service_fields`**（v1，catalog-first）。

---

## 2. 部署时的迁移执行

- **容器启动自动迁移**：`docker-entrypoint.sh` 执行 `cd app && prisma migrate deploy`；**失败即阻断启动**（`set -e`，迁移非零退出则容器退出，配合 `restart: always` 自动重试）。
  - 依据：`(app)` 各 `data.ts` 已直连 Prisma 查询，半迁移的 schema 对外服务会在真实请求上报运行时错误；宁可 fail-fast 重试，也不带病服务。
  - 前提：DB 在 compose 里被 `depends_on: service_healthy` 网关，因此此处失败代表真实迁移问题，而非冷启动未就绪。
  - 历史：曾为「失败仅告警、仍启动」（前提是"当时无路由读 DB"）；该前提已不成立，故收紧为阻断。
- **健康门槛**：compose 中 `arda-app` `depends_on: arda-db { condition: service_healthy }`，DB 健康后才起应用（但这只保证 DB 可连接，不保证迁移成功）。
- **每栈独立执行**：prod 用 `DATABASE_URL=...@arda-db:5432/arda`，beta 用 `...@arda-beta-db:5432/arda`，互不影响。

---

## 3. 运行时拓扑（部署视角）

| 服务 | 镜像 | 端口 | 卷 |
|---|---|---|---|
| `arda-app` | 自有镜像 `arda-app` | `APP_PUBLISH_PORT`（prod 3230 / beta 3231） | 无（无状态） |
| `arda-redis` | `redis:7-alpine` | 内部 | `${DATA_DIR}/redis:/data`（AOF） |
| `arda-db` | `postgres:16-alpine` | 内部 | `${DATA_DIR}/postgres:/var/lib/postgresql/data` |

每栈数据目录：prod `/srv/md0/arda/data`、beta `/srv/md1/arda-beta/data`。

**备份现状**：`deploy/scripts/55-backup-runtime-state.sh` 现已覆盖 Postgres —— 对运行中的 `${PROJECT_NAME}-db` 容器执行 `pg_dump -Fc` 逻辑备份（一致快照、可 `pg_restore`），写临时文件并经 `pg_restore --list` 完整性校验后才落 `postgres-<ts>.dump`，纳入 30 天保留清理。Redis 目录、`.env`、crontab 备份不变。
> 恢复演练（restore drill）尚未固化为脚本/流程 —— 备份可用不等于恢复可用，建议后续补一条 `ops.sh restore` 或运维手册步骤（见 §5）。

---

## 4. 现状 vs 目标态

### 4.1 种子数据：dev-only，尚未对接生产填充路径

| 项 | 现状 | 目标态（ADR §4） |
|---|---|---|
| 填充方式 | `prisma/seed.ts` + `npm run db:seed`，硬编码 `SEED_WORKSPACE_ID=dev-ws-001` | 平台建 workspace + 标记 `seedStatus` → arda 首次进入按 `SeedTemplate` 克隆进真实 `workspaceId` |
| 是否在部署跑 | **否**（仅本地/CI 手动） | 由用户首次进入触发，非部署时机 |
| 结果 | beta/prod 的真实 workspace **当前是空态** | 有数据可视 |
| Schema 就位度 | `WorkspaceRef.seedStatus`、`SeedTemplate`/`TemplateVersion` 已建表 | 克隆执行逻辑待实现 |

**行动项**：要让线上"看得见数据"，需二选一：(a) 手动给真实 `active_workspace` 灌一次 dev-seed 风格的数据；(b) 落地 ADR §4 的模板填充流程。(b) 是正确的长期路径。

### 4.2 权益（entitlement）：仍读 token claim，未接平台端点

| 项 | 现状 | 目标态（ADR §3.5） |
|---|---|---|
| 数据来源 | OIDC token 的 `arda` claim（`MockEntitlementResolver` 直通） | 平台只读端点：按 `(workspaceId, product=arda)` 实时拉取 |
| 缓存 | 无（每次直读 claim） | Redis 短 TTL 缓存 + 平台 `invalidate` 失效通知（秒级生效） |
| arda 是否建镜像表 | 否 | 否（两种方案都不建表，仅信任源不同） |
| 枚举 | `Tier` 已对齐 ADR 五档（`free\|starter\|pro\|business\|enterprise`）；`ArdaState` 仍是 `free`（ADR 目标 `none`） | 五档 tier 已达标；`state` 的 `free→none` 待随平台 claim 契约变更一并改 |

**行动项**：`ArdaState` 重命名不是 arda 单方面能定的 —— 需平台侧 claim 契约先定，避免两边语义再次漂移。见[平台对接要求](../workplan/vxture-platform-integration-requirements.md)。

### 4.3 平台指令通道（seed / wipe / invalidate）：schema 已备，执行链路未接

| 项 | 现状 | 目标态（ADR §5.1） |
|---|---|---|
| 幂等键 | `AuditLog.idempotencyKey`（全局唯一）已建 | 平台指令按此键防重放 |
| 审计 | `AuditLog` 表已建，尚无写入调用点 | 每条平台指令必须落审计 |
| 服务间鉴权 | 未实现 | 服务间签名（API key / 服务 JWT / mTLS，待与平台确定） |
| wipe 执行 | 未实现 | 按 `workspaceId` 软删 + 延迟 N 天硬删 |

**行动项**：这是当前 schema 与实际能力差距最大的一块 —— 表已建，内部端点与鉴权尚未实现。

### 4.4 领域扩展：v1 之外的 `future` 实体

| 实体 | 现状 | 影响 |
|---|---|---|
| 列级 `Field` | 未建模（catalog 详情页 `schema` tab 用 demo 静态字段） | 无法做列级治理/血缘 |
| `Pipeline` / `JobRun` | 未建模 | ETL 屏走静态 seed（`(app)/etl/seed.ts`），非真实调度数据 |

这两项在领域目录中明确标 `future`，非遗漏 —— 建表前置是先有真实业务需求驱动（数据搬运 / 列级治理）。

---

## 5. 待办清单（按优先级）

1. ~~**确认 Postgres 备份覆盖**~~ **[已完成]** `55-backup-runtime-state.sh` 已加 `pg_dump -Fc` 逻辑备份 + 完整性校验（见 §3）。
2. ~~**决定迁移失败的启动策略**~~ **[已完成]** 收紧为「失败即阻断启动」（见 §2）。
3. **补恢复演练/流程**：备份已就位，但恢复（`pg_restore`）尚无固化脚本或运维手册步骤 —— 补一条 `ops.sh restore` 或 runbook 步骤，并做一次演练验证 dump 可恢复。
4. **落地平台指令通道**：内部端点 + 服务间签名 + 幂等 + `AuditLog` 写入 + wipe 软删/延迟硬删。落地方案见 [`arda-data-arch-workplan.md`](arda-data-arch-workplan.md)。
5. **落地权益实时拉取**：接平台只读端点后切换 `EntitlementResolver`，加 Redis 缓存 + invalidate 消费。落地方案见 [`arda-data-arch-workplan.md`](arda-data-arch-workplan.md)。
6. **落地模板填充**：`SeedTemplate` 内容策展 + 首次进入检测 `seedStatus` + 克隆逻辑（先全量复制，重量模板可评估 copy-on-write）。落地方案见 [`arda-data-arch-workplan.md`](arda-data-arch-workplan.md)。
7. **`ArdaState` 枚举对齐**：待平台 claim 契约确认 `free`/`none` 语义后统一修改。落地方案见 [`arda-data-arch-workplan.md`](arda-data-arch-workplan.md)。

---

## 6. 与既有文档的漂移（需修正）

数据层是中途引入的，若干文档曾停留在"Redis-only / 两服务"旧态。两批均已修正（下列两表存档说明修了什么）。首批（核心拓扑）：

| 文档 | 旧述 | 现状 | 处理 |
|---|---|---|---|
| `ADR-entitlement-and-workspace.md` §0 | "arda 目前没有数据层（Redis-only，无 Prisma/无 DB）" | 已有 Prisma 7 + Postgres（0001~0005） | **[已修]** §0 加前置更新说明 |
| `implementation/repository.md` | "docker-compose = 两服务（arda-app + arda-redis）"；无 `prisma/`；列旧 IA 路由 | 三服务（+arda-db）；有 `prisma/`；新 IA | **[已修]** 三服务 + prisma/ + 真实 IA |
| `design/architecture.md` | 容器拓扑仅 app+redis；env 表无 `DATABASE_URL` | +arda-db；每栈 `DATABASE_URL` | **[已修]** 拓扑/端口/env/隔离段 |
| `docker-compose.yml` 顶部注释 | "arda-app + arda-redis ONLY" | 含 arda-db | **[已修]** 三服务注释 |
| `portals/app/docker-entrypoint.sh` 注释 | "no route depends on the DB yet" | 6 个 `data.ts` 已读 DB | **[已修]** 随 §2 收紧一并更新 |

**第二批（已修）** —— 运维/模块文档补齐 arda-db：

| 文档 | 旧述 | 处理 |
|---|---|---|
| `docs/agent.md` | 容器表只列 arda-app / arda-redis | **[已修]** 加 arda-db 行 + 三容器网络说明 |
| `docs/design/modules.md` | 无 `arda-db` 模块小节；"None. The app is stateless" | **[已修]** 补完整 arda-db 模块 + DATABASE_URL + arda-net 成员 |
| `docs/operations/operations.md` | 健康检查/日志只提 arda-redis | **[已修]** 加 arda-db 日志 + Postgres Operations（连通性/迁移/查数/备份恢复） |
| `docs/deployment/checklists.md` | 部署后核对只列 app/redis | **[已修]** 加 arda-db healthy + 迁移成功 + Postgres host-only 契约 |
| `docs/deployment/deployment.md` | env 表无 `DATABASE_URL`；连通性只测 redis | **[已修]** 加 DATABASE_URL / POSTGRES_PASSWORD + pg 连通性 |
| `docs/specs/security.md` | 只述 Redis key space | **[已修]** 加 Domain Data Store 安全段 + ingress 提及 arda-db |

---

## 7. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-06-30 | 首版：盘点 schema `0001`~`0005`，梳理三层文档结构（本文件 + `arda-data-architecture.md` + `arda-data-architecture-schema.md`），列出现状/目标差距与文档漂移 |
| 2026-07-02 | P0/P1 收口：#1 Postgres 纳入备份（`pg_dump -Fc` + 校验）；#2 迁移失败收紧为阻断启动；#6 首批文档漂移修正（ADR §0 / repository.md / architecture.md / compose 注释 / entrypoint 注释），第二批漂移登记；新增 P2/P3 落地方案文档 `arda-data-arch-workplan.md` |
| 2026-07-02 | #6 第二批文档漂移修正：agent.md / modules.md / operations.md / checklists.md / deployment.md / security.md 全部补齐 arda-db（模块、排障、核对项、env、数据面安全） |
