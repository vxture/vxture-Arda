# 回函 09：申请将连字符域文档命名注册为 taxonomy 变体（plat-290）

> 签发：2026-07-17 03:00（时间标记 2607170300）
> 收方：vxture-platform（org docs taxonomy 权威 `docs/10-standards/070-docs-taxonomy.md` §3/§7）
> 性质：标准演进申请（governance「新缺口先补进标准再整顿」条款）；不阻塞 arda 侧整顿（已按现状落地）

## 1. 事项

taxonomy §3 规定域文档命名 `{kind}_{domain}_{NNN}_{slug}`（下划线制）。arda 仓既有域文档
系列为**连字符制** `arda-{sub}-NNN-slug.md`（`sub` ∈ plat/biz/data/ent；`NNN` 段义与 §3 一致：
1xx 架构 / 2xx 细化 / 3xx 实施），共 60+ 篇，先于 taxonomy 定稿存在，且是 taxonomy 自述的
「范式来源」。owner 决策（2026-07-17）：不做 60 篇改名迁移，保留连字符制。

申请：在 taxonomy §3 增补一行注册该变体——
「连字符变体 `{product}-{sub}-{NNN}-{slug}.md` 视同已编号（arda 仓既有系列，产品名作前缀、
子域缩写代 domain 全词）；新仓/新系列仍用下划线制」。

## 2. arda 侧现状（已落地）

- `scripts/guardrails/check-docs-numbering.mjs --strict`（quality-gate 硬门）同时接受两制：
  `NN-` / `arda-[a-z]+-\d{3}(-.+)?` / `{prefix}(_{domain})?_{NNN}` / `ADR-|TD-NNN`。
- 顶层 decades、ADR/TD 寄存器、00-index 等其余条款与 taxonomy 完全一致（整顿批 D，PR #140）。

## 3. 对齐点

若 platform 认为下划线制必须收敛，arda 可在后续批次做整体改名（成本：60+ 文件 + 全仓内链 +
git 历史可读性）；在 taxonomy 明文裁定前，arda 以本回函 + 仓内整顿记录
（`docs/70-workplan/30-governance-rectification-2607.md`）为准执行连字符制。
