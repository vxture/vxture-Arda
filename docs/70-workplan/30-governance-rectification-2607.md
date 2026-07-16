# 仓库整顿记录（2026-07-17，依据 org 治理标准）

> 依据：vxture-platform `docs/10-standards/140-repo-governance-standard.md` + `docs/50-deployment/rebuild/20-self-rectify-runbook.md`。
> 本文是整顿的**在仓存档**：做了什么、记名偏差、遗留项。后续新缺口先补标准再整顿（governance 边界条款）。

## 1. 批次与落地（每批一 PR，全部已合入）

| 批 | PR | 内容 |
| -- | -- | ---- |
| A/B 主干+密钥四层 | #139 | 独立 `gitleaks` 必查（全史 detect）；`.husky/pre-commit`；ci 加 `push:main`（契约脚本原"禁 push 触发"断言反转）；`portal-build`→`build`；ruleset 必查=quality-gate/build/audit/gitleaks |
| D docs 编号 | #140 | 顶层 decades 对齐 taxonomy（00-meta…90-memory）；80 篇全编号；ADR 寄存器 `30-design/decisions/`（ADR-001/ADR-011，空号保留）；`check-docs-numbering.mjs --strict` 接 quality-gate；全仓 0 断链 |
| F 数据层 | #141 | 手写 DDL 单一权威 `deploy/database/ddl/`（baseline + `arda_svc` 最小权限 + 列锁白名单）；`db-init.yml` 唯一 DB 结构管道（confirm+expected_sha+环境审批）；入口/镜像不再 migrate；prisma 降为 client 工具（migrations 目录删除）；`check-data-architecture.mjs` 硬门 |
| GitHub 侧 | - | 删死值 `BETA_ENV_CONTENT`/`PROD_ENV_CONTENT`；删空 `develop` 环境 |

本就达标未动：批 C（SCA 门）、批 E（稳健 CD 构件，本仓即参照实现）、容器健康标准、批 G 骨架。

## 2. 记名偏差（owner 授权 2026-07-17）

1. **仓库保持 public**（标准检查清单要求私有；全史 gitleaks 0 泄露为兜底，敏感内容按"已公开"对待）。
2. **域文档连字符制** `arda-{sub}-NNN-slug`（标准为下划线 `{kind}_{domain}_{NNN}`）——护栏两制皆认；已回函 platform 申请写入 taxonomy 作注册变体（见 `../80-liaison/arda-plat-290-taxonomy-hyphen-variant-2607170300.md`）。

## 3. 遗留项

- **TD-001 测试基建**：owner 决定引入真实测试基建（vitest + `test-coverage` 必查），见 [`../60-operations/40-tech-debt.md`](../60-operations/40-tech-debt.md)。
- **[owner 操作] arda_svc 三段式生效**：设 `ARDA_DB_SVC_PASSWORD` 环境密钥（beta/production）→ db-init `roles`+`verify` → 主机 `etc/.env` 切 `DATABASE_URL`（beta 先行）。步骤见 [`../60-operations/30-operator-runbook.md`](../60-operations/30-operator-runbook.md) §5。
- **[owner 操作] 本机装 gitleaks**（`scoop install gitleaks`），pre-commit 层从告警转拦截。
- 下一个 release tag 才会把"入口不 migrate"的镜像带上线；该窗口内不改 schema。
