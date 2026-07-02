# 数据标准与主数据 功能设计（ad-ba-44-standards-master）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`ba-40`](ad-ba-40-functions.md)；数据模型：[`arda-data-architecture-schema.md`](arda-data-architecture-schema.md) §4.3（`Standard`）
> 本文合并**数据标准**与**主数据**两个维度——二者同属 DAMA「**参考与主数据管理**」（权威口径/定义），故一篇两节（`ba-10` §1.1「数据定义」对）。如需拆成两篇再议。

---

## A. 数据标准（含参考数据）

### A1. 功能定义
定义、发布、维护**数据标准**（代码集 / 数据元 / 参考数据），统一口径；参考数据可对外查询。

### A2. 贯通链

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| 目标·定义 | 定标准 / 数据元 / 参考值 | `Standard{type(code-set/data-element), ref, status(draft/review/published)}` | 标准 → 供落标/引用 |
| 过程·执行 | 落标、评审（draft→review→published）、术语关联 | `Standard` CRUD + status 流转；落标 = 资产符合性标注 | 已发布标准 → 供符合性/约束 |
| 结果·看 | 标准库、**符合性**（哪些资产符合哪些标准）、usage | `Standard` 列表 + 符合性关联 | 符合性 → 画像结果面（`ba-42`） |
| 服务·用 | 标准作为约束（质量/服务引用）；参考数据对外查询 | 质量规则引用标准；参考数据发布为服务（`ba-48`） | — |
| 监管·审计 | 标准变更 / 发布审计 | `AuditLog{action: standard.publish/change}` | 审计流水 |

### A3. 断链
| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `S-BL1` | 结果：符合性（资产↔标准）未建模 | `Standard.usage` 只是数字，无资产关联 | 加 `StandardBinding(datasetId↔standardId)` | da、`ba-42` |
| `S-BL2` | 过程：评审流缺 | `status` 是字段，无流程/审批 | 落评审流 | — |
| `S-BL3` | 服务：参考数据对外查询缺 | code-set 未作为服务对外 | 参考数据发布为查询服务 | `ba-48` |
| `S-BL4` | 监管：标准审计未接 | 变更/发布不落审计 | 补写入点 | `ba-49`/admin |

---

## B. 主数据（MDM，轻量优先）

### B1. 功能定义
把核心业务实体（客户/产品/供应商等）维护为**权威金记录（MDM）**。**轻量优先**（金记录标注 + steward + 质量 + 主数据服务）；**重型引擎（匹配/合并/survivorship）深度待定**（`ba-10` §1）。

### B2. 贯通链

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| 目标·定义 | 定主数据模型 / 权威源 / 金记录标准 | （轻量）`Dataset` 标记主数据 + `ownerUserId`(steward) + 关联 `Standard` | 金记录定义 → 供治理 |
| 过程·执行 | 标金记录、指派 steward、（轻量）匹配/合并/去重、质量规则 | `Dataset` 主数据标记 + `QualityRule`；（重型 match/merge 待定） | 金记录 → 供画像/服务 |
| 结果·看 | 金记录清单、主数据健康、权威源标识 | 筛选主数据 `Dataset` + 聚合质量 | 金记录 → 画像、主数据服务 |
| 服务·用 | 主数据服务（金记录对外 API，高价值） | `DataService`（`ba-48`）发布 | — |
| 监管·审计 | 主数据变更 / 合并审计 | `AuditLog{action: master.change/merge}` | 审计流水 |

### B3. 断链
| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `M-BL1` | 目标：金记录标记未建模 | `Dataset` 无主数据标识（`core` ≠ 主数据） | 加轻量标记 `Dataset.isMaster`/`masterDomain` | da |
| `M-BL2` | 过程：匹配/合并/survivorship 缺 | 重型 MDM 未实现，**深度待定** | 先轻量；重型待产品决策 | 决策 |
| `M-BL3` | 服务：主数据服务未接 | 金记录未发布为服务 | 经 `ba-48` 发布 | `ba-48` |
| `M-BL4` | 监管：主数据审计未接 | 变更/合并不落审计 | 补写入点 | `ba-49`/admin |

> 原则（`ba-23` §7）：**先做轻量，决策前不建 MDM 专用实体**。

---

## C. 数据模型 · 依赖 · 门控（两节共用）

- **数据模型**：`Standard`（v1）；`StandardBinding`（S-BL1，待需求）；`Dataset.isMaster`/`masterDomain`（M-BL1，轻量迁移）；重型 MDM 实体不建（待定）。
- **依赖**：资产（`ba-42` 符合性/金记录标注、画像）、质量（`ba-45`）、服务（`ba-48` 参考/主数据服务）、审计（`ba-49`/admin）。
- **门控（提议键）**：`arda.governance.standards`、`arda.governance.master_data`（**domain-entities §3.1 未列，需补入目录**，见 `ba-40` §5）；写 = `admin`/`steward`；看 = `arda.assets.catalog` baseline。
