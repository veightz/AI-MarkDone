# PRD：Chrome Web Store 未列出（unlisted）发布

> **状态**：**paused**（2026-10-08）— 用户暂不付 CWS 开发者注册费；材料保留。分发主线改油猴 Lite（`10-08-userscript-lite`）。
> ~~材料准备中（仓库产物 + 清单）；**不在此任务内登录商店仪表盘**。~~  
> **优先级**：P1（解决解压装更新摩擦）。  
> **盖章**：Violet + User — 走商店未列出；解压 zip 保留开发/应急；油猴 Lite 不开。  
> **前置探路**：`10-08-self-hosted-chrome-update`（自托管 CRX **不作**主更新方案）。

## 目标

1. 个人用 **unlisted** 上架 MarkDone（veightz），装一次后走商店自动更新。  
2. 文案一眼可与上游商店原版 AI-MarkDone 区分；勿与原版同开。  
3. 仓库内备好：中英文 listing、权限说明、隐私政策正文、去上游 `key` 的上传 zip、人工步骤清单。

## 非目标

- 不在本任务登录 Chrome Web Store / Google 开发者账号（群聊也无法完成 SSO）。  
- 不上公开（public）列出；不做油猴 Lite；不实现自托管 `update_url` 流水线。  
- 不把上游商店商品接管过来（veightz **不拥有**上游 item `bmdhdihdbhjbkfaaainidcjbgidkbeoh`）。

## 仓库已交付

| 产物 | 路径 |
| --- | --- |
| 中文 listing | `docs/chrome-store/STORE-LISTING-zh.md` |
| 英文 listing | `docs/chrome-store/STORE-LISTING-en.md` |
| 权限与审核说明 | `docs/chrome-store/PERMISSIONS.md` |
| 隐私政策正文 | `docs/chrome-store/PRIVACY-POLICY.md` |
| 扩展 ID / key 建议 | `docs/chrome-store/EXTENSION-ID-AND-KEY.md` |
| 上传用 zip（无 `key`、无 `update_url`） | `/workspace/releases/AI-MarkDone-veightz-chrome-store-unlisted.zip`（构建自 `dist-chrome`，上传前再确认） |

## 人工必须完成的步骤（User / Violet 私聊）

1. **Chrome Web Store 开发者账号**  
   - 一次性注册费约 **USD $5**。  
   - 用你自己的 Google 账号；接受开发者协议。

2. **仪表盘登录 + 新建商品**  
   - https://chrome.google.com/webstore/devconsole  
   - 新建扩展 → 上传 zip（本仓 store-unlisted 包）。  
   - **Visibility = Unlisted**（仅链接可装，不进商店搜索）。  
   - 上传包 **不要**带上游 `key`（见 EXTENSION-ID-AND-KEY）；商店会分配**新的**扩展 ID。

3. **商店素材**  
   - 至少 1 张 1280×800 或 640×400 截图（阅读器跟人走 / 大纲钉住等）。  
   - 可选宣传图；小图标用包内 `icons/icon128.png`。  
   - 名称 / 简述 / 详述：复制 `STORE-LISTING-*.md`。

4. **隐私政策公开 URL**  
   - CWS 要求可公网访问的 Privacy Policy URL。  
   - 正文已写在 `docs/chrome-store/PRIVACY-POLICY.md`。  
   - 托管建议（任选其一，私聊定）：  
     - GitHub Pages：把该文件挂到 `veightz.github.io` 或本仓 `docs` 站点；  
     - 或 raw 稳定页（注意 raw.githubusercontent.com 偶发不适合当正式页，**优先 Pages / 正式 HTML**）；  
     - 临时：`https://github.com/veightz/AI-MarkDone/blob/main/docs/chrome-store/PRIVACY-POLICY.md` 仅作过渡，审核可能挑剔。

5. **单用途 / 权限说明**  
   - Dashboard「Privacy practices」按 `PERMISSIONS.md` 勾选与填写。  
   - 远程代码：无；数据出售：无。

6. **提交审核 → 通过后把 unlisted 安装链接发给自己**  
   - 卸掉解压版 / 关掉上游商店版，再装 unlisted，避免同页双扩展。

7. **（强烈建议，可后做）Drive OAuth 换绑**  
   - 新扩展 ID ≠ 上游 ID → 现有 `oauth2.client_id` **不会**对你的新 item 生效。  
   - 在 Google Cloud 新建 Chrome Extension OAuth 客户端，绑**新 ID**；更新 `config/extension/cloudBackup.ts` 后再发一版。  
   - 在此之前：核心本地功能可用；**可选 Drive 备份会失败或不可用**。

## 推荐执行顺序

```
材料进仓（本任务）→ 私聊托管隐私 URL → 开发者账号 $5
→ 仪表盘上传 zip（无 key）→ 填 listing / 截图 / 隐私 URL
→ Unlisted 提交审核 → 拿到新扩展 ID
→（可选）换 OAuth + 把新 public key 写回 chromeWebStore.ts 对齐解压开发 ID
```

## 开放问题（需盖章 / 私聊确认）

1. 隐私政策托管选 Pages 还是别的域名？  
2. 首版是否接受 **Drive 备份暂不可用**，等拿到新 ID 再换 OAuth？还是提交前就先建好 Cloud 项目（需先有扩展 ID，通常「先传包拿 ID → 再配 OAuth → 再传一版」）？  
3. `homepage_url` 仍指向上游站点；是否改成 fork README / 自建页后再传？  
4. 商店语言默认 en + zh_CN 是否够用？  
5. 图标是否沿用上游视觉（MIT），还是换一套以免与原版视觉混淆？

## 验收

- [ ] 仓库文档齐全并可复制进 Dashboard  
- [ ] store zip 无 `update_url`、无上游 `key`  
- [ ] phase-boundary 写明：unlisted 为主更新路径；自托管探路结束不作主方案  
- [ ] User 在私聊完成账号 / 截图 / 隐私 URL / 提交（本任务外）

## 参考

- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy  
- https://developer.chrome.com/docs/webstore/cws-dashboard-listing  
- 自托管探路：`.trellis/tasks/10-08-self-hosted-chrome-update/prd.md`  
- Drive OAuth 现状：`docs/runbooks/chrome-google-drive-oauth.md`
