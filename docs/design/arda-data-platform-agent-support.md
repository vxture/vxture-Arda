# arda 通用数据平台：对智能体/外部消费方的数据域支撑（arda-data-platform-agent-support）

> 状态：设计（待评审）
> 范围：**仅 arda 数据域**。设计 arda 作为通用数据平台，如何被外部业务智能体（方案编写/法务/知识服务等）
> 与其他应用**消费**——即 arda 对外提供什么数据能力、契约与边界
> 不在本文范围（属其他产品/仓库）：知识库(kb)、智能体本身、编排/RAG/向量检索、LLM 调用、交付物生成
> 上游依据：[`ADR-11-subscription-entitlement-design.md`](../ADR-11-subscription-entitlement-design.md)（统一 Product / 权益）、
> [`ADR-entitlement-and-workspace.md`](../ADR-entitlement-and-workspace.md)（SoR 边界 / workspace 隔离）、
> [`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md)（arda feature-key 目录）、
> [`arda-data-architecture.md`](arda-data-architecture.md)（arda 持久层）

---

## 0. 定位与边界（先读，最重要）

**arda 只负责数据域。** 在 vxture 生态里 arda 是 ADR-11 的 `data` Product——一个通用数据平台（数据资产 / 元数据 / 治理 / 数据服务）。业务智能体（方案编写 `agent_writing`、法务 `agent_legal`、知识服务 `agent_knowledge`……）、知识库 `kb`、智能体编排、RAG/向量检索、LLM 调用、交付物生成——**都是生态里其他产品/仓库的职责，arda 不建、不设计、不承载**。

本文只回答一个问题：

> **arda 作为数据域，要对外提供什么，才能让外部智能体/应用把 arda 的数据用起来——且用得可信、隔离、可计量？**

arda 的角色是**被消费方**（provider），不是智能体的宿主，也不是知识底座。智能体如何 grounding、如何 RAG、如何编排，是消费方的事；arda 只保证"喂出去的数据是可信、受控、可溯源的"。

**SoR 边界（沿用 ADR §1.7）**：

| 归属 | 内容 | 落在哪 |
|---|---|---|
| **arda（数据域）** | 数据资产 / 元数据 / 治理 / 数据服务 | arda 自己的库（`workspaceId` 隔离） |
| 其他产品 | 知识库、智能体、编排、RAG、交付物 | 各自仓库，**不在本仓** |
| 平台侧（vxture） | 订阅 / 权益 / 计费 / 计量 | vxture 平台，arda 不建镜像表 |
| 身份层（IdP） | 账号、`active_org`/`active_workspace`、`roles` | accounts.vxture.com |

---

## 1. arda 在生态中的位置

```
   外部消费方 (其他产品/仓库, 不在本仓)
   ┌─────────────────────────────────────────────┐
   │ agent_writing  agent_legal  agent_knowledge  │   ← 智能体: 自己做编排/RAG/LLM/交付物
   │ 其他应用 / BI / 报表 / 下游数据产品            │
   └───────────────────────┬─────────────────────┘
                           │ 消费 arda 数据 (只读取数, 不搬运)
                           │ 经: 数据服务 API / 目录查询 / 导出
                           ▼
   ┌─────────────────────────────────────────────┐
   │              arda = data Product              │   ← 本仓职责边界
   │  数据资产目录 · 元数据 · 治理(分级/策略/质量/  │
   │  血缘) · 数据服务(API/查询/导出/共享)          │
   │  按 workspaceId 隔离 · 权益门控 · 分级过滤      │
   └───────────────────────┬─────────────────────┘
                           │ 复用平台服务
                           ▼
   身份/隔离(IdP) · 权益/计量(vxture 平台, ADR-11) · 存储
```

arda 对外只有一条价值主张：**提供可信、受控、可溯源的数据**，供任意消费方（含智能体）使用。arda 不关心消费方是不是智能体。

---

## 2. arda 的差异化：治理即"可信数据"保证

智能体/下游用数据最大的风险是"数据不可信、不可溯源"。arda 已有的治理能力，正是把这个风险挡在数据域这一侧的控制面——这是 arda 对生态的核心价值，且**全部已存在、无需新建**：

| arda 现有能力 | 对消费方的意义 |
|---|---|
| 分级 `classification`（AssetLevel）+ 策略 `Policy` | 敏感/核心数据按策略脱敏或不对外暴露；分级随数据流出 |
| 质量 `QualityRule/QualityResult` | 只把达标数据标记为"可用于生产/决策"，低质量数据降权/标注 |
| 血缘 `LineageEdge` + 数据服务 `DataService` | 消费方引用的每份数据可回链到源、可实时取数（非快照），天然可溯源 |
| 目录 `Dataset` + 术语 `GlossaryTerm` + 标准 `Standard` | 统一口径与语义，避免消费方对同一指标各自理解 |

> 净结论：arda 不做 RAG，但**保证喂进任何 RAG/智能体的数据是被编目、被分级、被质检、可溯源的**。这是"数据域"能给智能体的、别人替代不了的价值。

---

## 3. arda 的对外数据契约（数据域要提供什么）

arda 面向消费方的能力，绝大部分**已经存在**（`DataService` + 目录）；本文只把它们明确为"对外契约"，并补齐访问控制不变量。

### 3.1 消费面（已存在，明确为对外契约）

| 契约 | 载体（现状） | 说明 |
|---|---|---|
| 数据服务 | `DataService`（rest_api / query / export / share）+ `ApiKey` | 消费方通过发布的服务端点取数（实时/查询/导出） |
| 目录/元数据查询 | catalog（`Dataset` + facets + 搜索） | 消费方发现"有哪些可用数据、口径、分级、质量" |
| 语义/标准 | `GlossaryTerm` / `Standard` | 统一术语与代码集，供消费方对齐口径 |

### 3.2 访问控制不变量（对外时必须成立）

数据一旦对外被智能体消费，以下门控**必须在 arda 侧收口**（不能指望消费方自觉）：

1. **workspace 隔离**：任何对外取数都带 `workspaceId`，只返回该 workspace 的数据（沿用 arda 隔离键约束）。
2. **权益门控**：消费方对 arda 数据的访问受 `(workspace, product=arda)` 订阅能力键控制（如 `arda.services.publish_api`、`arda.services.data_products`）。
3. **分级/策略过滤**：返回结果按 `classification` + `Policy` 脱敏/裁剪；`sensitive/core` 数据不流向无权限消费方。
4. **凭证与审计**：服务调用经 `ApiKey`（存哈希、可吊销、scoped）；每次对外取数可落 `AuditLog`（可溯源"谁在何 workspace 取了什么"）。
5. **配额**：对外调用量受 `arda.quota.api_requests_monthly` 等配额约束（平台计量）。

### 3.3 是否需要新增"面向智能体"的能力？（待评审，见 §7）

- **语义检索/向量**：明确**不属 arda 数据域**（属 kb/智能体产品）。arda 提供结构化数据与治理元数据，语义层由消费方做。
- **一个统一的"数据消费只读契约"**：现有 `DataService` 是否已足够，还是需要补一个标准化的、供智能体批量取"目录+元数据+样例"的只读端点？倾向"先用现有 DataService，不足再补"，避免为假想需求提前造接口。

---

## 4. data 作为 Product 的权益映射（落到 ADR-11）

arda = `data` Product。沿用 [`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md) 的 `arda.*` 能力键/配额键，无需为"被智能体消费"另立命名空间：

- **能力键**：`arda.services.publish_api` / `arda.services.data_products`（对外提供数据的能力）、`arda.assets.catalog`（目录可见）等。
- **配额键**：`arda.quota.api_requests_monthly`（对外请求量）、`arda.quota.service_endpoints`（服务数）、`arda.quota.datasets` 等。
- **Plan 打包**：在"智能体 Plan"里，`data` 常作 **bundled_free 附带底座**（standard 档）随智能体一起给；workspace 若单独订 `data:pro` 则能力就高合并、全局升档（ADR-11 §11.3）。
- **计量**：对外取数的请求量由平台按订阅计量（ADR-11 §11.5/§11.6），arda 只上报数字、不上报数据内容。

> arda 不硬编码"档位→功能"；键由 arda 定义，每档开放哪些键/配额由平台下发（ADR §3.4）。

---

## 5. SoR 与隔离（跨产品一致）

- **隔离键唯一**：`workspaceId` 是 arda 与所有消费方之间唯一的隔离契约；arda 对外只按其返回数据。
- **内容 vs 数字**：数据内容 = arda 端 SoR；对外请求量/计量 = 平台 SoR。arda 不存订阅/计量镜像（ADR §3.5 实时拉取 + 缓存 + invalidate）。
- **只读取数、不促搬运**：arda 鼓励消费方**引用**其数据（经服务实时取数），而非把 arda 数据复制进消费方的库——保持单一事实源与可溯源。若消费方确需落地副本，分级/来源应随之传递（消费方责任）。

---

## 6. 与现有 arda 的关系（几乎不新增）

- **定位澄清**：arda 就是"通用数据平台/数据域"，本文不改变其职责，只把"对外被消费（含被智能体消费）"这条链路的**契约与门控不变量**写清楚。
- **复用为主**：catalog / governance / quality / lineage / `DataService` / `ApiKey` / `AuditLog` / workspace 隔离 / 权益范式**全部沿用**。
- **可能的小增量**：把 §3.2 的对外访问不变量（分级过滤、对外审计、配额）在 `DataService`/`ApiKey` 路径上校验齐全；是否新增一个标准化只读消费端点待 §7 定。**不引入 kb、不引入智能体逻辑。**

---

## 7. 待确认事项

1. **对外消费端点是否需要标准化**：现有 `DataService`（rest_api/query/export/share）是否已满足智能体批量取"目录+元数据+受控样例"的需要？还是补一个统一只读契约？（倾向先用现有，不足再补。）
2. **分级随数据流出的传递方式**：对外结果如何携带 `classification`/来源，使消费方能承接分级（响应头？字段？）——需与消费方约定。
3. **对外取数审计粒度**：是否每次对外取数都落 `AuditLog`，还是采样/聚合（量大时的成本权衡）。
4. **`arda.quota.api_requests_monthly` 的计量点**：在 arda 服务层计数上报平台，还是平台在网关侧计量——需与平台对接要求对齐。

---

## 8. 明确不做（out of scope，属其他产品）

为防止范围蔓延，以下**明确不在 arda/本仓**，出现相关需求应转交对应产品：

- 知识库 `kb`：文档/切块/向量/检索——属 kb 产品。
- 业务智能体 `agent_*`：任务编排、提示工程、RAG、LLM 调用、交付物（方案/法务意见/答案）——属各智能体产品。
- 向量存储 / 语义检索 / embedding——属 kb/智能体产品。
- 智能体的计量业务口径（如 `doc.words`）——属对应智能体产品；arda 只管 `arda.*` 数据配额。

> arda 提供**受治理的数据**；消费方用它做智能体。两者以 `workspaceId` + 平台 Entitlement + 对外数据契约三者解耦，各守边界。
