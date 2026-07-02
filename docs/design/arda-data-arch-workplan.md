# arda 数据架构 · P2/P3 落地方案（arda-data-arch-workplan）

> 状态：落地设计（尚未实现；本轮只出方案，不写代码）
> 范围：三个跨迭代大项的落地路径 —— 模板填充（P2）、平台指令通道（P3）、`ArdaState` 对齐（P3）
> 上游依据：[`ADR-entitlement-and-workspace.md`](../ADR-entitlement-and-workspace.md)（§3.5 权益、§4 模板、§5.1 平台指令）、
> [`arda-data-architecture.md`](arda-data-architecture.md)、现状/待办见 [`arda-data-architecture-migration.md`](arda-data-architecture-migration.md) §4/§5
> 平台侧契约见 [平台对接要求](../workplan/vxture-platform-integration-requirements.md)

---

## 0. 为什么这三项单独成文

它们的共同点：**schema 已就位、执行链路未接**，且多数依赖平台侧先定契约。放进 migration 文件会把"现状跟踪"和"未来设计"混在一起，故抽出为独立落地方案，各自可作为一个（或多个）PR 的实现依据。三项互相解耦，可并行推进，但都不阻塞已完成的 P0/P1。

依赖关系速览：

| 项 | schema 就位度 | 平台依赖 | 可独立启动 |
|---|---|---|---|
| P2 模板填充 | `WorkspaceRef.seedStatus` / `SeedTemplate` / `TemplateVersion` 已建 | 需平台在建 workspace 时写 `seedStatus`（弱依赖，可先用手动标记验证） | 是（arda 侧可先跑通克隆逻辑） |
| P3 平台指令通道 | `AuditLog.idempotencyKey` 已建 | **强依赖**：服务间鉴权方案、指令载荷契约需平台共定 | 否（需先与平台定契约） |
| P3 `ArdaState` 对齐 | `Tier` 已对齐五档；`ArdaState` 仍 `free` | **强依赖**：claim 中 `state` 语义（`free` vs `none`）由平台定 | 否 |

---

## 1. P2 - SeedTemplate 首次进入填充

### 1.1 目标

真实 workspace 首次进入 arda 时，若平台标记其需要示例数据，则按选定的 `SeedTemplate` 版本把内容克隆进该 `workspaceId`，使新用户"看得见数据"而非空态。这是 migration §4.1 的目标态，替代当前 dev-only 的硬编码 `SEED_WORKSPACE_ID=dev-ws-001`。

### 1.2 触发时机与判定

- **触发点**：用户首次通过门控进入 `(app)` 布局（`app/(app)/layout.tsx` 已有 session + entitlement 检查），在其中加一次"是否需要填充"的判定。
- **判定依据**：`WorkspaceRef` 行的 `seedStatus`。约定取值：
  - `null` / 缺行 —— 未知/无需填充（默认不动）。
  - `pending` —— 平台标记需填充，尚未执行。
  - `seeding` —— 填充进行中（防并发重入的租约态）。
  - `done` —— 已填充，跳过。
  - `failed` —— 上次失败，允许重试。
- **幂等/并发**：以 `WorkspaceRef` 行为并发边界，用条件更新 `pending -> seeding`（`updateMany where seedStatus=pending`，受影响行数=1 才继续）拿到"填充租约"，避免同一 workspace 多请求同时克隆。填充结束置 `done`；异常置 `failed` 并写审计。

### 1.3 模板来源与克隆

- **模板存储**：`SeedTemplate` + `TemplateVersion.manifest`（Json，全局只读、非 workspace 隔离）。`manifest` 描述一组领域实体（Dataset/Tag/Policy/QualityRule/... 及其关联），用相对 id 引用彼此。
- **版本选择**：约定"当前默认模板 + 最新 version"或由平台在 `seedStatus` 里带模板/版本标识（契约见 §1.5）。
- **克隆语义**：读取 `manifest` -> 在一个事务内按依赖顺序创建实体，所有行写入目标 `workspaceId`，`manifest` 内相对 id 映射为新生成的 `cuid()`。展示编码（`code`/`name`/`term`）保持模板值（workspace 内唯一即可）。
- **重量模板**：v1 先全量复制；若 `manifest` 增大到明显拖慢首屏，再评估异步任务 / copy-on-write（不在首版范围）。

### 1.4 失败与可观测

- 克隆全程在事务内，失败即回滚，`seedStatus=failed`，不留半套数据。
- 每次填充（成功/失败）写一条 `AuditLog`（`actor="platform"` 或 `"system"`，`action="seed"`，`target=templateVersionId`，`metadata` 记录计数/耗时）。

### 1.5 平台侧需要的契约（弱依赖）

- 平台在创建/开通 workspace 时，向 arda 表达"需要示例数据" —— 两种落法二选一：
  - (a) 平台直接写 arda 的 `WorkspaceRef.seedStatus=pending`（需平台可写 arda 库，通常不建议）；
  - (b) 平台通过 §2 的指令通道下发 `seed` 指令，arda 自己置位。**推荐 (b)**，与指令通道统一。
- 在契约就绪前，可用手动置 `seedStatus=pending` 验证 arda 侧克隆逻辑。

### 1.6 交付切分（建议 PR 粒度）

1. 策展一份默认 `SeedTemplate`/`TemplateVersion`（把现有 dev-seed 内容迁成 `manifest`）。
2. 实现克隆器（读 manifest -> 事务写入目标 workspace）+ 单测。
3. 在 `(app)` 布局接入首次进入判定 + 租约 + 审计。

---

## 2. P3 - 平台指令通道（seed / wipe / invalidate）

### 2.1 目标

让平台能安全地对 arda 下发三类指令（ADR §5.1），全部幂等、可审计：

- `seed` —— 标记/触发某 workspace 的示例数据填充（与 §1 衔接）。
- `wipe` —— 用户不续订/删除时，按 `workspaceId` 清除领域数据（软删 + 延迟硬删）。
- `invalidate` —— 使 arda 侧缓存的权益失效（与 §3 权益实时拉取衔接）。

### 2.2 端点与鉴权（强依赖平台共定）

- **形态**：arda 暴露一个内部端点（如 `POST /api/internal/commands`），仅供平台服务端调用，不面向浏览器。
- **鉴权**：服务间身份，三选一，需与平台确定（ADR §5.1 列为待定）：
  - 服务 API key（最简单，密钥轮换靠运维）；
  - 服务 JWT（平台签发、arda 验签，可带 scope/过期）；
  - mTLS（最强，运维成本最高）。
  - **倾向**：先服务 JWT（与现有 OIDC 生态一致，验签逻辑可复用），mTLS 作为后续加固。
- **载荷契约**：`{ command, workspaceId, idempotencyKey, args }`，需与平台逐字段定稿。

### 2.3 幂等与审计

- **幂等**：每条指令带平台生成的 `idempotencyKey`，落 `AuditLog.idempotencyKey`（已 `@unique`）。写入前先查该键：命中则直接返回上次结果（不重复执行），未命中才执行并落审计。
- **审计**：每条指令无论成功失败都落 `AuditLog`（`actor="platform"`，`action=command`，`target=workspaceId`，`metadata` 记录参数/结果）。这是 ADR §5.1 的硬要求。

### 2.4 wipe 的执行语义

- **软删 + 延迟硬删**：收到 `wipe` 先做逻辑标记（不可逆操作留缓冲），延迟 N 天后由定时任务硬删。N 与是否可"反悔恢复"需产品确认。
- **范围**：严格按 `workspaceId` 收口所有领域表；`SeedTemplate`/`TemplateVersion`（全局）不受影响。
- **注意**：当前 schema 无软删列（如 `deletedAt`）。落地 wipe 前需评估：是给相关表统一加软删列，还是 wipe 直接硬删 + 依赖备份恢复。这是一个 schema 决策点，需单列迁移。

### 2.5 交付切分

1. 与平台定稿：鉴权方式 + 载荷契约（阻塞项，先出契约 PR/文档）。
2. 实现内部端点 + 验签 + 幂等查重 + 审计写入（先接 `seed`/`invalidate`，二者无破坏性）。
3. 单列 schema 决策 + 迁移后再接 `wipe`（破坏性，最后做）。

---

## 3. P3 - `ArdaState` 枚举对齐（free -> none）

### 3.1 现状与目标

- **现状**（migration §4.2）：`Tier` 已对齐 ADR 五档（`free | starter | pro | business | enterprise`）；`ArdaState` 仍是 `free`，ADR 目标为 `none`。
- **问题**：`state`（订阅状态）与 `tier`（权益档位）语义不同；`ArdaState` 用 `free` 既像"无订阅"又像"免费档"，与 `Tier.free` 语义重叠，是漂移隐患。

### 3.2 为什么不能 arda 单方面改

`state` 取自 OIDC token 的 `arda` claim，语义由平台定。arda 若单方面把 `free` 改 `none`，会与平台下发的 claim 值不一致，导致门控误判。必须平台侧 claim 契约先定 `state` 合法值集合。

### 3.3 落地路径（依赖平台）

1. 平台确认 claim 中 `state` 的合法取值（是否含 `none`、`free` 是否废弃）。
2. 平台与 arda 约定切换窗口（claim 侧与解析侧同版本发布，避免跨版本语义空窗）。
3. arda 侧改 `entitlement/types.ts` 的 `ArdaState`，同步 `MockEntitlementResolver` 与门控判定，加迁移期兼容（同时接受旧 `free` 与新 `none`，过渡后移除）。

### 3.4 与权益实时拉取的关系

本项与 migration §5-5「权益实时拉取」同属 entitlement 演进：拉取信道从 token claim 迁到平台只读端点时（ADR §3.5），`state` 的值域也应一并定稿，二者最好同批推进，避免 entitlement 语义两次变更、两次回归。

---

## 4. 推进顺序建议

1. **P2 模板填充** —— arda 侧可独立启动，直接解决"线上空态"，用户可感知收益最大。
2. **P3 指令通道（seed/invalidate）** —— 与平台定契约后接非破坏性指令；`seed` 指令与 P2 衔接。
3. **P3 `ArdaState` + 权益实时拉取** —— entitlement 语义与信道一并定稿，同批推进。
4. **P3 指令通道（wipe）** —— 破坏性最强，需先做软删 schema 决策，最后接。
