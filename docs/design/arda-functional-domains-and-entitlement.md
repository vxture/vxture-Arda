# arda 功能域划分与权益/权限门控设计（arda-functional-domains-and-entitlement）

> 状态：设计（待评审）· 目的：把「数据管理 / 治理 / 服务」现有能力划分为可独立开通的**功能域**，
> 设计支持后续按**订阅**与**权限**两个维度分别开通/收紧的门控机制
> 上游：`docs/ADR-entitlement-and-workspace.md`（§3 订阅权益模型、§1.7 SoR 边界）、
> [`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md)（领域实体 + feature-key 目录 v1）
> 下游：本文件是门控重设计（ADR §8.4）与平台对接（[平台对接要求](../workplan/vxture-platform-integration-requirements.md)）的直接输入
> 证据基准：`origin/develop`（迁移至 `0005_service_fields`）

---

## 0. 现状总结（先摆事实，再设计）

### 0.1 已实现、真实工作的能力（按功能分类，非按屏幕）

| 分类 | 能力 | 证据 | 实现程度 |
|---|---|---|---|
| **数据资产管理** | 资产目录（列表/卡片双视图 + 域筛选 + 搜索） | `(app)/catalog/` | DB 支撑（`Dataset`） |
| | 资产详情（字段结构 / 数据预览 / 质量 / 血缘入口 / 权限申请表单） | `(app)/catalog/[id]/asset-detail.tsx` | DB 支撑 + 申请表单已实现（未接审批流） |
| | 标签、业务术语表 | `Tag`/`GlossaryTerm` 模型 | **仅建表，无独立界面**（标签只在资产卡片内联展示） |
| **数据集成** | 外部数据源登记 | `DataSource` 模型 | **仅建表，无界面**（登记/连接配置尚无 UI 入口） |
| | 任务编排（ETL） | `(app)/etl/` | **静态 seed**，非 DB 支撑（`Pipeline`/`JobRun` 是 `future`，未建表） |
| **数据治理** | 数据标准（代码集/数据元库） | `(app)/standards/` | DB 支撑（`Standard`） |
| | 数据质量（规则 + 检查结果 + 六维评估） | `(app)/quality/` | DB 支撑（`QualityRule`/`QualityResult`） |
| | 数据血缘（图谱） | `(app)/lineage/` | **静态 seed**（`LineageEdge` 已建表，但 UI 未接库——多类型节点图与 v1 schema 尚未对齐） |
| | 数据安全（分级分布 + 共享审批 + 脱敏策略） | `(app)/security/` | DB 支撑（`Policy` + `Dataset.classification`） |
| **数据服务** | 服务/API 目录（发布状态、调用统计） | `(app)/service/` | DB 支撑（`DataService`） |
| **管理** | API Key 管理、审计日志查看 | `ApiKey`/`AuditLog` 模型 | **仅建表，零界面**（无路由、无入口） |

> **结论**：8 个屏幕里，5 个真实读写 Postgres（catalog/standards/quality/security/service），2 个是静态占位（etl/lineage 的图谱部分），1 个分类（admin）**有数据模型但完全没有产品界面**。

### 0.2 权益门控的真实现状（这是本设计要解决的核心问题）

- `EntitlementGate`（`entitlement/gate.tsx`）**只做二元判断**：`subscription.status === "active"` → 放行全部功能；否则整页替换为升级提示。**没有任何按 tier、按功能域、按具体能力键的区分。**
- `MIN_TIER`（`entitlement/config.ts`）虽然定义了，但**在 gate.tsx 里从未被读取或比较** —— 是死代码，配置了也不生效。
- `Subscription` 类型（`entitlement/types.ts`）目前只有 `{ tier, status }` 两个字段，**没有 `features[]`、没有 `quota`**。domain-entities-and-feature-keys.md §3 设计的 18 个能力键 + 9 个配额键，**在代码里没有任何表示** —— 完全是纸面设计。
- 导航（`NAV` 分组 + `BOARDS` 功能域启动器）**对所有用户恒定渲染全部菜单项**，无任何入口级门控；`future` 标记只是「开发中占位」，与订阅/权限无关。

### 0.3 权限轴：已有输入源，但完全未被消费（重要发现）

- IdP 的 access token 已经带 `roles`（字符串数组），`claims.ts` → `IdentityClaims.roles` → `session.ts` → `getSession().roles` 全链路已打通，`/auth/session` 也已暴露。
- **但没有任何地方读取 `session.roles` 做门控判断。**
- Header 上展示的「用户等级」徽章（`USER_LEVELS`，1~5 级 + 皇冠图标）是**硬编码演示值**（`header.tsx` 里 `const level = 5`），与真实 `roles` claim **完全没有关联**。

**净结论**：平台侧订阅信息（tier/state）已经能拿到，IdP 侧角色信息（roles）也已经能拿到，但两条链路目前都只走到「有 session 就整站放行」这一步，**没有任何功能域级或能力级的门控**。这正是本设计要补的空白。

---

## 1. 设计目标

1. 把现有能力**划分为一组功能域（Functional Domain）**，作为「订阅开通」和「权限管控」共同的**门控单位**——而不是像现在这样，导航分组（NAV）、启动器分组（BOARDS）、feature-key 分组（group）三套并存却互不一致的名字。
2. 门控做成**两级粒度**：域级（这个域对当前 workspace 是否可见/可用）→ 能力键级（域内具体哪些能力开放）→ 配额（数值上限）。
3. 门控做成**两个独立维度的组合**，不要混在一起：
   - **订阅维度**（商业）：workspace 的 (workspace, product=arda) 订阅决定「买了什么」——tier → 能力键列表 + 配额，**由平台配置下发**，arda 不硬编码。
   - **权限维度**（组织内部）：workspace 内该用户的角色决定「你有没有权做这件事」——来自 IdP `roles` claim，**arda 不定义角色本身**，但 arda 定义「角色 → arda 域/能力的最低权限要求」这张映射（类比 feature-key 的键由 arda 定义、值由平台配置）。
4. 让「按订阅/权限开通功能域」成为一个**可运营的动作**：平台改一条订阅配置或角色分配，域即刻在 arda 侧生效（呼应 ADR §3.5 的 invalidate 秒级生效要求），不需要 arda 改代码发版。

---

## 2. 功能域（Functional Domain）canonical 划分

### 2.1 现状三套命名不一致（先对齐）

| 命名体系 | 用途 | 现有取值 |
|---|---|---|
| `NAV` 分组 | 侧边栏分组 | 概览 / 资产治理 / 共享应用（3 组，把治理和服务混在"共享应用"里，etl 也在这组） |
| `BOARDS` | 启动器功能域切换 | asset / integrate / govern / analyze / serve（5 个，govern 和 analyze 把"治理"拆成两半） |
| feature-key `group` | 能力键命名空间 | assets / integration / governance / services / admin（5 个，含 admin，无 analyze） |

三套体系画的边界不一样（尤其"血缘算不算独立于治理"、"admin 算不算一个域"），这本身就是需要先收敛的技术债。

### 2.2 推荐的统一功能域（6 个）

| 域 id | 名称 | 含屏幕 | 是否受门控 |
|---|---|---|---|
| `overview` | 总览 | dashboard | **恒开**（所有档位含 free，无需门控——是产品的落地页） |
| `assets` | 数据资产 | catalog（+ 未来 tag/glossary 独立界面） | 订阅 + 权限 |
| `integration` | 数据集成 | 数据源登记（待建界面）、etl（任务编排） | 订阅 + 权限 |
| `governance` | 数据治理 | standards, quality, lineage, security | 订阅 + 权限 |
| `services` | 数据服务 | service | 订阅 + 权限 |
| `admin` | 管理 | API Key 管理、审计日志（待建界面） | **权限为主**，订阅为辅（见 §4.3） |

**变更说明（相对现状）**：
- **`governance` 合并原 `govern` + `analyze`**：血缘（lineage）本质是治理能力的一部分，从商业角度通常整档打包出售，拆开会让门控矩阵和定价复杂度翻倍且无明确收益。**若未来定价确实要把"血缘/影响分析"单独作为增值项**，可以在 governance 域内用能力键 `arda.governance.lineage` 单独收费（域开、键不开），不需要拆成独立域——两级粒度（域+键）本身就覆盖了这个诉求，无需为此多开一个域。
- **`etl` 从 `NAV` 的"共享应用"移到 `integration` 域**：概念上任务编排属于集成能力，不属于对外服务能力，现状分组是历史遗留、应修正。
- **新增 `admin` 域**：现状 `ApiKey`/`AuditLog` 有表无界面无导航项，属于产品缺口而非有意省略——本设计把它正式纳入功能域清单，即使界面还没建。

> 本节改动只涉及**分类/命名对齐**与文档，不要求本次连带重排 `NAV`/`BOARDS` 代码——留给 §7 实施路线里单独一步，避免与门控机制改造混在一个 PR。

---

## 3. 两轴门控模型

```
                     ┌─────────────────────┐        ┌─────────────────────┐
                     │   订阅维度 (商业)     │        │   权限维度 (组织内)   │
                     │  平台是 SoT           │        │  IdP 是 SoT (roles)  │
                     │  (workspace,product)  │        │  session.roles[]     │
                     │  → tier → features[]  │        │  → arda 定义:        │
                     │      + quota{}        │        │  角色→域/能力的       │
                     │                       │        │  最低权限要求         │
                     └──────────┬────────────┘        └──────────┬──────────┘
                                │                                 │
                                └───────────────┬─────────────────┘
                                                 ▼
                                   canAccess(domain, featureKey?)
                                   = subscriptionAllows(domain, key)
                                     AND permissionAllows(domain, key, roles)
                                                 │
                        ┌────────────────────────┼────────────────────────┐
                        ▼                        ▼                        ▼
                  导航可见性门控           路由级布局门控              动作级/配额门控
               (隐藏/置灰未开通的域)    ((app)/<domain>/layout.tsx)   (data.ts 写操作前二次校验)
```

### 3.1 订阅维度（不变更 ADR 既有设计，本节只是复述+对齐）

- 单位：`(workspaceId, product="arda")`。
- 载荷：`{ state, tier, features: string[], quota: Record<string, number> }`。
- **能力键的"键"由 arda 定义**（§5 目录），**"每档开放哪些键+配额数值"由平台的订阅配置下发**——arda 不硬编码 tier→feature 映射。
- 来源：当前仍读 token 的 `arda` claim（无 features/quota）；目标态是平台只读端点实时拉取 + Redis 短 TTL 缓存 + `invalidate` 通知（见 `arda-data-architecture-migration.md` §4.2、平台对接要求）。**本设计要求 `Subscription` 类型扩展 `features`/`quota` 字段**，无论数据来自 claim 还是端点。

### 3.2 权限维度（新引入，此前完全未设计）

- 单位：**当前 workspace 内的当前用户**（不是订阅，是会话）。
- 载荷：`session.roles: string[]`（已从 IdP token 拿到，格式待与平台/IdP 确认词表，如 `owner`/`admin`/`member`/`viewer`）。
- **角色词表由 IdP/平台定义与分配**（arda 不做角色管理界面，不做成员邀请——这些是平台的"成员/角色/席位"能力，归属边界见 ADR §1.7）。
- **"角色 → arda 域/能力的最低权限要求"这张映射由 arda 自己定义**（类比 feature-key："键"由产品定义）——因为只有 arda 知道"管理 API Key"这种操作需要多高权限，平台/IdP 不该管这个。
- 用途：即使某功能域已被订阅开通（商业上买了），**组织内部仍可能希望限制"谁能做敏感操作"**——例如：全员能看 governance 的 quality/standards（只读），但只有 `admin`/`owner` 能新建 Policy、管理 API Key、查看审计日志。这是订阅开不开无法回答的问题，必须有权限维度兜底。

### 3.3 组合门控函数（设计契约，非代码）

```
canAccessDomain(domain, session)
  = subscription.features.includesDomainBaseline(domain)   // 订阅：这个域至少开了基线能力
    AND permission.roleMeetsMin(domain, session.roles)      // 权限：角色够格看这个域

canUseFeature(domain, featureKey, session)
  = canAccessDomain(domain, session)
    AND subscription.features.includes(featureKey)          // 订阅：这个具体能力键开了
    AND permission.roleMeetsMin(featureKey, session.roles)   // 权限：某些键有单独更高的角色门槛（如 admin.audit_log）

checkQuota(quotaKey, currentUsage)
  = currentUsage < subscription.quota[quotaKey]              // 配额：数值上限（写操作前检查，非布尔）
```

三个函数分别对应 §0.2 提到的三个当前缺失点：域级二元判断、键级判断、配额判断。

---

## 4. 门控落点（在哪些地方生效）

按防御深度分三层，**不能只做 UI 层**（否则和现在的 `future` 占位一样只是好看，可被直接改路由绕过）：

### 4.1 导航可见性（UX 层，体验优化，非安全边界）

- `Sidebar`/`Header launcher` 渲染前调用 `canAccessDomain`：
  - 未开通（订阅不含）→ 域整体隐藏或置灰 + "升级解锁"提示（区别于 `future` 的"开发中"占位——**这两种状态的文案必须不同**，否则用户分不清是没买还是没做完）。
  - 权限不够（订阅有但角色不够）→ 域可见但置灰 + "需要 XX 权限"提示（不是升级提示）。

### 4.2 路由级布局门控（安全边界第一层）

- 每个功能域一个 `(app)/<domain-group>/layout.tsx`（或等效的服务端校验点），进入即校验 `canAccessDomain`；不满足 → 重定向到「域未开通」页（携带原因：订阅 or 权限），而不是渲染后再前端隐藏。
- 这是当前完全空白的一层——现状只有最外层 `AccountGate`(会话) + `EntitlementGate`(整站二元)，域级布局校验不存在。

### 4.3 动作/配额门控（安全边界第二层，防止只做了导航层被绕过）

- 每个敏感写操作（发布服务、创建 Policy、生成 ApiKey、执行血缘影响分析等）在 `data.ts` 层**再校验一次** `canUseFeature`；不能只信任前端已经隐藏了按钮。
- 配额类操作（登记数据源、发布服务端点等）在写入前 `checkQuota`，超限时返回明确的"已达配额，升级或联系管理员"错误，而不是静默失败或数据库约束报错。

`admin` 域的具体门控倾向（对应 §2.2）：域级判断以**权限为主**（如"能否看到管理菜单"取决于角色是否 owner/admin），配额/是否可用为辅（如 ApiKey 数量上限仍走订阅配额）。

---

## 5. 数据结构改造（目标态，非本文件直接实施）

### 5.1 `Subscription` 类型扩展

现状（`entitlement/types.ts`）：
```ts
export interface Subscription {
  readonly tier: Tier;
  readonly status: SubscriptionStatus;
}
```

目标态：
```ts
export interface Subscription {
  readonly tier: Tier;
  readonly status: SubscriptionStatus;
  readonly features: readonly string[];        // 平台下发的当前生效能力键
  readonly quota: Readonly<Record<string, number>>; // 平台下发的当前生效配额数值
}
```

### 5.2 能力键目录（复用已有设计，不重新发明）

沿用 `domain-entities-and-feature-keys.md` §3 的 18 个能力键 + 9 个配额键与命名规范（`arda.<group>.<capability>` / `arda.quota.<name>`），**只需把 `group` 对齐到 §2.2 的 6 个功能域 id**（`assets/integration/governance/services/admin`，`overview` 无需能力键——恒开）。

### 5.3 角色 → 域/能力最低权限映射（新引入，arda 自有配置）

```ts
// 示意：arda 自有、随代码演进，不依赖平台配置
export const DOMAIN_MIN_ROLE: Record<DomainId, string[]> = {
  overview: [],                          // 无限制
  assets: [],                            // 订阅内全员可用
  integration: [],
  governance: [],
  services: [],
  admin: ["owner", "admin"],             // 管理域整体需要更高角色
};

export const FEATURE_MIN_ROLE: Partial<Record<FeatureKey, string[]>> = {
  "arda.governance.policies": ["owner", "admin"],   // 新建/改策略需要更高角色
  "arda.admin.api_keys": ["owner", "admin"],
  "arda.admin.audit_log": ["owner", "admin"],
};
```

> 角色词表（`"owner"`/`"admin"`/…）需要与 IdP/平台确认实际 `roles` claim 的取值——这是待办事项，不是本设计能单方定的（见 §8）。

---

## 6. 与 `future`（未建能力）状态的关系

三种"看不到/不能用"的状态必须在 UI 上区分清楚，不能混为一谈：

| 状态 | 含义 | UI 文案 |
|---|---|---|
| `future`（产品未建） | 这个能力 arda 还没做 | "开发中，敬请期待" |
| 订阅未开通 | 产品做了，但该 workspace 的档位没买 | "升级订阅解锁" + CTA |
| 权限不足 | 产品做了、订阅买了，但当前用户角色不够 | "需要管理员权限" |

现状代码只有第一种状态（`nav-config.ts` 的 `future?: boolean`），第二、三种完全空白——这是本设计新增的两类状态需要在导航渲染逻辑里补上。

---

## 7. 实施路线（分阶段，避免一次性大改）

1. **域级二元开关（最小可用）**：`Subscription.features` 只做「域基线」的粗粒度开关（如 `arda.assets.baseline`），先把 §4.2 的路由级布局门控接上，验证"平台配置一条 → arda 域即时开关"的端到端链路。**不做能力键级和配额级**——先把最大的安全空白（无路由级校验）补上。
2. **能力键级**：接入 §5.2 的完整能力键目录，域内按键细粒度控制（如 governance 域开了但 `arda.governance.lineage` 单独收费的场景）。
3. **权限维度接入**：消费 `session.roles`，接入 §5.3 的角色映射，先做 `admin` 域（现成的空白点，风险最低、收益最直观）。
4. **配额计量**：接入 `arda.quota.*`，在写操作路径加计数与拦截；AI 相关配额复用 AI Gateway（ADR §3.3），其余配额（数据源数、数据集数、服务端点数）在 arda 自己计数。
5. **导航/IA 重排**：把 §2.2 的域收敛落到 `NAV`/`BOARDS` 代码里（etl 挪到 integration、govern+analyze 合并），与 §1-4 的门控机制改造分开提交，降低单个 PR 的风险面。
6. **补齐 `admin` 域界面**：`ApiKey` 管理 + `AuditLog` 查看页面从零建（现状表已就绪，具体见 `arda-data-architecture-schema.md` §4.5）。

---

## 8. 待确认事项

1. **IdP `roles` claim 的实际取值词表**：现在只知道是 `string[]`，需要平台/IdP 确认具体角色名（`owner`/`admin`/`member`/`viewer`？还是别的），才能定稿 §5.3 的映射表。
2. **域基线能力键的粒度**：§7 步骤 1 的"域基线开关"是否需要在平台订阅配置里单独建一个键，还是用"域内任一能力键"来推导域级可见性——需要和平台entitlement 端点的实际字段设计（见平台对接要求 §3）对齐后再定。
3. **`governance` 是否要在未来拆分血缘为独立计费项**：本设计推荐先合并、用能力键差异化收费（§2.2 已述），但最终定价策略由产品/商业侧决定，非本文件能拍板。
