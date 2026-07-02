# 通用业务智能体产品族与通用数据/知识底座（agent-products-and-data-substrate）

> 状态：设计（待评审）
> 范围：把「方案编写 / 法务咨询 / 知识服务」等**通用业务智能体**统一为一类产品archetype，
> 并设计支撑它们的**通用数据/知识底座**；给出分层、复用、权益映射、隔离边界与 MVP 切分
> 上游依据：[`ADR-11-subscription-entitlement-design.md`](../ADR-11-subscription-entitlement-design.md)（统一 Product / 能力就高合并 / 额度独立成池 / 瀑布扣减）、
> [`ADR-entitlement-and-workspace.md`](../ADR-entitlement-and-workspace.md)（SoR 边界 / workspace 隔离）、
> [`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md)（feature-key 目录）、
> [`arda-functional-domains-and-entitlement.md`](arda-functional-domains-and-entitlement.md)（两轴门控）、
> [`arda-data-architecture.md`](arda-data-architecture.md)（arda 持久层）
> 拓扑决策：**独立智能体产品 + 共享底座**（arda = 数据平台底座；智能体为独立 Product，对齐 ADR-11 的 `agent_writing`/`agent_analysis`）

---

## 0. 定位与边界（先读）

ADR-11 已把世界建模为**统一 Product**：`data`（数据平台=arda）、`kb`（知识库）、`agent_writing`（方案编写）、`agent_analysis`（数据分析）同构，均可独立订阅、分档、能力就高合并、额度独立成池。本设计不推翻它，而是把其中**「智能体类 Product」抽象为一个可复用的 archetype**，并把 `data + kb` 明确为**所有智能体共享的通用数据/知识底座**。

一句话结论：

> **业务智能体不各自造轮子**。每个智能体 = 一层「任务编排 + 领域提示 + 交付物模型」，**下面复用同一套底座**（数据/知识 grounding、身份/隔离、权益/计量、AI Gateway）。新增一个业务智能体（法务、招投标、尽调……）= 配一个 Product + 领域提示 + 交付物 schema，**不新建平台能力**。

**边界（沿用 ADR §1.7 的 SoR 分工）**：

| 归属 | 内容 | 落在哪 |
|---|---|---|
| 智能体产品侧 | 任务、上下文、交付物（方案正文/法务意见/答案）等**业务数据** | 各产品自己的库（按 `workspaceId` 隔离） |
| 底座产品侧（data/kb） | 结构化数据资产 + 非结构化知识 + 治理元数据 | arda（data）+ kb 产品的库 |
| 平台侧（vxture） | 订阅/权益/计费/授权、Org 与 workspace 生命周期、**计量事实** | vxture 平台，产品端不建镜像表 |
| 身份层（IdP） | 账号、`active_org`/`active_workspace`、`roles` | accounts.vxture.com |

**本设计不做**：不重定义订阅/权益算法（ADR-11 已定稿，本文只映射）；不做 IdP 角色管理；不自建 AI 计量（复用 AI Gateway）。

---

## 1. 分层架构

```
┌───────────────────────────────────────────────────────────────────────────┐
│  业务智能体产品层 (Agent Products) —— 每个 = 一个 ADR-11 Product              │
│    agent_writing(方案编写)  agent_legal(法务咨询)  agent_knowledge(知识服务)  │
│    agent_analysis(数据分析)  ... 未来的招投标/尽调/合规                        │
│    每个只含: 任务模型 + 领域提示/工具集 + 交付物 schema + 领域评审流            │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ 统一「智能体 archetype」运行时管线 (§3)
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  通用数据/知识底座 (Substrate) —— grounding 的唯一来源                        │
│    data (arda): Dataset/目录/治理/质量/血缘/服务   ← 结构化 + 可信元数据       │
│    kb        : Collection/Document/Chunk/Embedding ← 非结构化知识 + 检索       │
│    统一「grounding 契约」: 按 workspace + 权益 + 分级策略过滤, 返回带引用的上下文 │
└───────────────┬───────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  共享平台服务 (Platform Services) —— 所有产品复用, 不重建                     │
│   身份/隔离(IdP+workspaceId) · 权益/计量(ADR-11) · AI Gateway · 对象存储 · 模板 │
└───────────────────────────────────────────────────────────────────────────┘
```

三层职责单一：**平台服务**提供身份/权益/AI/存储；**底座**提供可信的 grounding；**智能体**只装领域知识与交付物。越往上越薄、越易新增。

---

## 2. 通用数据/知识底座（通用性数据平台）

这是本设计的核心：把 arda 现有的数据平台**从"给人看的数据治理台"泛化为"给智能体喂料的可信 grounding 底座"**。

### 2.1 双底座：结构化(data) + 非结构化(kb)

| 底座 Product | 承载 | 现状 | 对智能体的价值 |
|---|---|---|---|
| `data`（arda） | 数据资产目录、字段、质量、血缘、分级、数据服务 | 已建（`0005`，catalog-first） | 让智能体引用**可信、已治理**的结构化数据（而非裸表） |
| `kb`（知识库） | 文档集合、切块、向量、检索 | **待建**（本设计新增底座） | 让智能体做 RAG：基于企业知识回答/起草，带引用 |

### 2.2 治理即"信任层"（arda 的差异化）

智能体最大的风险是幻觉与不可溯源。arda 已有的**分级(classification) / 策略(Policy) / 质量(QualityResult) / 血缘(LineageEdge)** 恰好是 grounding 的信任控制面：

- **分级 + 策略** → grounding 时按 `Dataset.classification` 与 `Policy` 过滤：`sensitive/core` 数据不进入低权限用户的智能体上下文；脱敏策略在检索层生效。
- **质量** → 只用 `QualityResult` 达标的资产 grounding，低质量资产降权或标注。
- **血缘/服务** → 交付物里的每个数据引用可回链到源资产（可溯源），并可通过 `DataService` API 实时取数而非快照。

> 净结论：**arda 的治理能力不是"另一个功能"，而是让智能体可信的前提**。这把"数据平台"与"业务智能体"从两件事变成一条价值链。

### 2.3 底座对智能体的统一契约（grounding contract）

所有智能体通过同一个只读契约取 grounding，不各自直连库：

```
retrieve(workspaceId, query, filters?) -> GroundedContext
  输入: workspaceId(隔离键) + 自然语言/结构化 query + 可选 filters(域/分级/时间)
  过程: 1) 权益门控(该 workspace 是否有 data/kb 的相应能力键)
        2) 权限门控(用户 roles 是否可见该分级/集合)
        3) 混合检索(kb 向量 + data 目录/服务) + 策略脱敏
  输出: GroundedContext {
          passages: [{ text, source, sourceType(dataset|document|service),
                       datasetId?|documentId?, score, classification }],
          citations: [...],           // 可回链, 供交付物溯源
          truncated: bool
        }
```

要点：**门控在检索层收口**（不是交给智能体自觉）；**每条 passage 带来源与分级**，交付物据此生成引用；跨产品仍以 `workspaceId` 为唯一隔离键。

### 2.4 kb 领域模型（待建，遵循 arda 数据架构约定）

沿用 [`arda-data-architecture.md`](arda-data-architecture.md) 的硬约束（每实体带 `workspaceId` 普通索引列、无跨平台 FK、workspace 内唯一、服务端强制过滤）：

| 实体 | 用途 | 关键字段 |
|---|---|---|
| `Collection` | 知识集合（一个知识库/项目空间） | `workspaceId, code, name, visibility` |
| `Document` | 原始文档（合同/规范/手册/网页） | `workspaceId, collectionId, title, mime, sourceUri, classification, status` |
| `Chunk` | 切块（检索与引用单位） | `workspaceId, documentId, ordinal, text, tokenCount` |
| `Embedding` | 向量（可外置向量库，schema 仅登记引用） | `workspaceId, chunkId, model, dim, vectorRef` |
| `RetrievalLog` | 检索审计（可选，计量/调优） | `workspaceId, agentProduct, query, hitIds[], createdAt` |

> 向量存储可用 Postgres `pgvector` 或外置向量服务；schema 层只登记 `vectorRef`，与 arda「可推导优于可存储、敏感值应用层加密」的原则一致。`Document.classification` 复用 arda 的 `AssetLevel` 枚举，使 data 与 kb 的分级语义统一。

---

## 3. 业务智能体 archetype（通用运行时管线）

任何业务智能体（方案/法务/知识/分析）都走同一条五段管线；**领域差异只在提示与工具集与交付物 schema**，管线本身复用。

```
① 任务intake      任务规格 {goal, params, workspaceId, 交付物类型}
        │
② grounding      调 §2.3 retrieve() 取带引用的可信上下文 (data + kb)
        │
③ 推理/编排      agent loop: plan -> tool calls -> LLM(经 AI Gateway) -> 反思
        │          工具集: 底座检索 / arda DataService 实时取数 / 模板 / 导出
        │          每次 LLM 调用: 携带 workspace+product 上下文 -> AI Gateway 计量
        │
④ 交付物         生成业务artifact(方案正文/法务意见/答案), 落产品端(workspaceId 隔离)
        │          artifact 带引用/溯源; 版本化; 走领域评审流(可选)
        │
⑤ 计量/审计      POST /usage/consume(doc.words / ai.calls...) -> 平台瀑布扣减
                   AuditLog: 谁在何 workspace 用哪个智能体产了什么(可溯源)
```

**archetype 的可复用性**：新增一个业务智能体，只需提供 ③ 的领域提示/工具白名单 + ④ 的交付物 schema + 领域评审规则；①②⑤ 完全复用。这正是"通用性"的落点。

**交付物 = 业务数据（产品端 SoR）**：内容留产品端，符合 ADR-11 §11.6「内容留产品端、数字进平台」。智能体产品各自有一张交付物主表（如 `WritingDoc` / `LegalOpinion` / `KbAnswer`），结构不同但都带 `workspaceId + citations + version`。

---

## 4. 共享平台服务复用矩阵

| 能力 | 提供方 | 智能体如何复用 | 是否重建 |
|---|---|---|---|
| 身份/登录/登出 | IdP（OIDC，arda 已实现 BFF 范式） | 复用同一 RP 范式（token 服务端、opaque cookie） | 否 |
| 隔离键 `workspaceId` | IdP claim `active_workspace` | 全部业务数据、grounding、计量按其收口 | 否 |
| 组织角色 `roles` | IdP claim | 权限维度门控（谁能用敏感智能体/看敏感集合），见功能域文档 §3.2 | 否 |
| 订阅/权益 | vxture 平台（ADR-11） | 每智能体=一个 Product 的 features/quota；能力就高合并 | 否 |
| 计量/配额 | vxture 平台 UsageMeter + AI Gateway | `doc.words`/`ai.calls` 池 + 瀑布扣减，产品端只上报数字 | 否 |
| 模型访问 | `@vxture/service-ai-gateway` | 所有 LLM 调用经此，天然计量 `ai.calls` | 否 |
| grounding | data(arda) + kb 底座 | §2.3 统一契约 | 底座建一次，智能体复用 |
| 交付物存储 | 对象存储 + 产品库 | 大文件走对象存储，元数据/引用入库 | 每产品一张主表 |
| 示例数据填充 | arda `SeedTemplate` 范式（已实现于 arda） | 智能体产品复用"首次进入按模板克隆"范式 | 复用范式 |

> 唯一"每个智能体各建一份"的是**交付物主表**（业务数据本就该各归各）；其余全部共享。

---

## 5. 权益与计量映射（落到 ADR-11）

### 5.1 每个智能体 = 一个 Product

Product id：`agent_writing`（方案编写）、`agent_legal`（法务咨询）、`agent_knowledge`（知识服务）、`agent_analysis`（数据分析，ADR-11 已有）。底座：`data`、`kb`。

### 5.2 feature-key 命名从 `arda.*` 泛化为 `<product>.*`

沿用 [`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md) 的规范（键由产品定义、每档开放哪些键+配额数值由平台下发），命名空间由单一 `arda.` 泛化为按 product：

```
能力键: <product>.<group>.<capability>      (布尔)
配额键: <product>.quota.<name>              (数值; merge=pool 为消耗型, merge=max 为上限型)
```

示例：

| Product | 能力键（示例） | 配额键（示例，merge） |
|---|---|---|
| `agent_writing` | `agent_writing.compose.generate` / `.templates` / `.export` | `agent_writing.quota.doc_words_monthly`(pool) / `.ai_calls_monthly`(pool) |
| `agent_legal` | `agent_legal.consult.qa` / `.contract_review` / `.clause_library` | `agent_legal.quota.ai_calls_monthly`(pool) / `.reviews_monthly`(pool) |
| `agent_knowledge` | `agent_knowledge.qa.ask` / `.cite` / `.multi_collection` | `agent_knowledge.quota.ai_calls_monthly`(pool) |
| `kb` | `kb.ingest.documents` / `.connectors` / `.retrieval_advanced` | `kb.quota.storage_bytes`(max) / `.documents`(max) |
| `data`(arda) | 沿用 `arda.assets.* / governance.* / services.*` | 沿用 `arda.quota.*` |

### 5.3 Plan 打包（业务方案）

Plan 打包多个 Product（ADR-11 §11.2），把"智能体 + 它所需的底座"卖成一个方案：

```
Plan「方案编写智能体」= [
  { product: agent_writing, tier: pro,      billing: charged,      features:[...], quota:{doc.words:1,000,000} },
  { product: data,          tier: standard, billing: bundled_free, features:[基线目录/检索] },   # 附带底座
  { product: kb,            tier: standard, billing: bundled_free, features:[基线检索], quota:{storage:10GB} }
]
```

- **能力就高合并**：若 workspace 另单独订了 `data:pro`，则 data 全局升 pro（ADR-11 §11.3 路 A）。
- **额度独立成池 + 瀑布扣减**：`agent_writing.doc_words` 与 `agent_analysis` 附带的报告字数各成池，附带的先扣（ADR-11 §11.5）。
- **计量点**：`ai.calls` 在 AI Gateway 计量；`doc.words` 等业务额度在智能体产品的交付完成处 `POST /usage/consume`（内容不上报，只报数字，ADR-11 §11.6）。

### 5.4 门控落点（复用功能域两轴模型）

沿用 [`arda-functional-domains-and-entitlement.md`](arda-functional-domains-and-entitlement.md) 的**订阅×权限两轴**与**三层防御**（导航可见性 / 路由布局校验 / 动作与配额校验）：智能体的"能否使用"= 订阅有该 Product 的能力键 AND 用户 roles 够格；"能否再生成一篇"= `checkQuota` 通过。

---

## 6. 三个实例（archetype 实例化）

| 维度 | 方案编写 `agent_writing` | 法务咨询 `agent_legal` | 知识服务 `agent_knowledge` |
|---|---|---|---|
| 任务intake | 方案主题/结构/受众 | 法律问题/合同文本 | 自然语言提问 |
| grounding 来源 | kb(模板/案例) + data(业务数据佐证) | kb(法规/合同库/条款) + data(主体/交易数据) | kb(企业知识为主) |
| 关键工具 | 大纲生成、模板填充、数据引用、导出 | 条款检索、合同审查、风险标注、依据引用 | 检索问答、多集合、引用 |
| 交付物(产品端) | `WritingDoc`（正文+引用+版本） | `LegalOpinion`（意见+依据条款+风险级） | `KbAnswer`（答案+引用+置信） |
| 主要计量 | `doc.words`(pool) + `ai.calls`(pool) | `ai.calls` + `reviews`(pool) | `ai.calls`(pool) |
| 领域评审流 | 可选人工润色/审批 | **建议强制**（法务需人复核，AI 仅辅助，非出具法律意见） | 可选事实核对 |

> 三者共用 §3 管线、§2 底座、§4 平台服务；差异只在提示/工具/交付物/评审——印证 archetype 的通用性。**法务尤其要在产品文案与评审流上明确"AI 辅助、非正式法律意见、需持证复核"的免责边界**。

---

## 7. SoR 与隔离边界（跨产品一致）

- **隔离键唯一**：`workspaceId` 贯穿所有产品（data/kb/agent_*）；任何库查询、grounding、计量都强制按其收口。跨产品**不共享运行态数据**，只共享 workspaceId 语义与平台下发的 Entitlement。
- **内容 vs 数字**：交付物内容 = 产品端 SoR；`used`（消耗量）= 平台 SoR（计费原材料）。`/usage/consume` 只报数字（ADR-11 §11.6）。
- **grounding 只读不搬**：智能体从底座**读**上下文，不把底座数据复制进自己的库（引用即可，保持单一事实源与可溯源）。
- **不建镜像表**：智能体产品不存订阅/Plan/计量镜像，实时向平台拉 Entitlement（ADR §3.5：拉取+短 TTL 缓存+invalidate 秒级生效）。

---

## 8. 与现有 arda 的关系

- **arda 定位微调**：从"数据治理台"升级为"**通用数据底座 `data` 产品 + 智能体的 grounding 提供方**"。现有 catalog/governance/quality/lineage/service **原样保留并复用**为信任层。
- **复用已落地能力**：workspace 隔离、Prisma+Postgres 数据架构、`SeedTemplate` 首次进入填充范式、（本轮 PR 的）entitlement 五档/`none` 对齐——智能体产品直接沿用这些范式，不重造。
- **arda 侧新增**：`kb` 底座领域模型（§2.4）与 §2.3 grounding 契约；是否把 `kb` 并入 arda 应用还是独立 `kb` 服务，见 §9 待确认。
- **嵌入式入口**：现有 Varda 助手（`ui/assistant.tsx`）可作为智能体在 arda 内的**对话入口/宿主壳**演进方向之一，但业务智能体作为独立 Product 计费（拓扑决策）。

---

## 9. 待确认事项

1. **`kb` 底座的产品/部署形态**：并入 arda 应用（多一个域）还是独立服务/产品？倾向独立 `kb` Product（对齐 ADR-11 统一 Product），但 v0 可先在 arda 内孵化再拆分。
2. **向量存储选型**：Postgres `pgvector`（少一个依赖，够用）vs 外置向量库（规模/性能）。影响 §2.4 `Embedding.vectorRef` 的具体形态。
3. **grounding 契约的部署位置**：作为 data/kb 各自的只读 API，还是一个统一"grounding 网关"？影响智能体的调用面与缓存策略。
4. **法务等强合规域的免责与评审强制度**：产品/法务侧确认文案与是否强制人工复核（§6）。
5. **IdP `roles` 词表**：权限维度门控依赖真实角色取值（承接功能域文档 §8 待办）。
6. **AI Gateway 的能力面**：是否已支持"按 workspace+product 计量 `ai.calls`"与模型路由（承接 domain-entities §3.3「已确认」，需核对实际 SDK 契约）。

---

## 10. MVP 切分（底座先行，对齐 ADR-11 三阶段）

```
MVP-0 底座最小可用: kb 领域模型(Collection/Document/Chunk/Embedding) + §2.3 retrieve()
                    先只做 kb 检索; data 侧 grounding 用现成目录/服务; 门控走 workspace+基础权益
   ↓
MVP-1 单智能体闭环: 选 agent_knowledge(最薄, 直接吃 kb) 打通 archetype 五段管线
                    + ADR-11 MVP-1(单 Plan 订阅/门控/计量) + ai.calls 经 AI Gateway 计量
   ↓
MVP-2 第二个智能体 + 多池: 上 agent_writing(交付物+doc.words 池) 验证 archetype 可复用
                    + ADR-11 MVP-2(多 Plan 合并/额度独立成池/瀑布扣减/附带底座)
   ↓
MVP-3 强合规智能体 + 治理信任层: 上 agent_legal, 接 §2.2 治理过滤(分级/策略脱敏进 grounding)
                    + 领域评审流 + 溯源引用完善
```

> 原则：**底座(§2)与 archetype(§3)先各打一遍最薄闭环，再横向复制智能体**。第一个智能体选 `agent_knowledge`（管线最短、直接吃 kb），验证"新增智能体只需领域层"的核心假设后，再上 writing/legal。
