# AI-MarkDone fork — 产品边界（起步）

- 上游：https://github.com/zhaoliangbin42/AI-MarkDone（MIT）
- 本仓：https://github.com/veightz/AI-MarkDone（fork，只推自己的 `main`）
- 需求用 Trellis；上游不直接推

## 落地顺序（已定）

1. **划选/消息工具条固定常显**（首条）— 去掉伸缩隐藏；修偶发不出现。  
   实现：`248ae56`（待 ChatGPT 真机 10× 划选回归）。**已完成**（`09-29-selection-toolbar-always-visible`）。
2. **阅读器跟随视口 + 文内大纲**（P0 / **已完成**）— 主入口跟随视口内主读助手回复（A 贴消息，窄屏回退 B）；底栏独立阅读器为次入口（无「分屏」文案）；回复内 1/2/3… +「一、」与标题大纲可跳转。  
   原「阅读器入口统一」**并入本条**。  
   任务：`09-29-reader-follow-viewport`（Violet stamps 已锁定）。  
   侧轨目录条**不作**阅读器主触发。
3. **阅读器宽屏选项** — 参照飞书文档：可切换加宽/铺满，默认勿锁死窄栏、少留白。  
   任务：`09-29-reader-widescreen`（排在 follow-viewport 之后）。
4. **大纲钉住** — **已完成**（`10-04-reader-outline-pin` / fork-6.0.0-dev.4）。
5. **刷新消息导航软刷新** — **已完成**（`10-04-soft-nav-refresh` / fork-6.0.0-dev.5）。

## 分发 / 更新（已定方向）

- **自托管 CRX + `update_url`**：探路结束（`10-08-self-hosted-chrome-update`）。可行性 partial；**不作**个人 Mac/Windows 主更新方案。
- **下一步（盖章）**：**Chrome 商店未列出（Unlisted）** — 装一次后商店自动更新。任务：`10-08-chrome-store-unlisted`（材料 + 人工上架清单）。解压 zip **保留**开发/应急。
- **油猴 Lite**：**不开**（等商店通路通了再评估）。
- 商店上传包须 **去掉上游 `key`**，由 CWS 分配新扩展 ID；Drive OAuth 需换绑（见 `docs/chrome-store/EXTENSION-ID-AND-KEY.md`）。

## 待用户继续丢的边界

其它删减 / 保留能力尚未列全；有新边界再补进本文件与任务。
