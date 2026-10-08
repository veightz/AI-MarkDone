# PRD / 探路：自托管 Chrome 自动更新（update_url + CRX）

> **状态**：research only（**未实现**）。  
> **优先级**：P1 体验（更新摩擦），非功能主线。  
> **触发**：用户嫌解压加载更新麻烦，想要接近油猴的「装一次跟新」；Violet 拍：先评估自托管自动更新，油猴 Lite 后置。

## 结论（给 Violet / 用户）

| 维度 | 判断 |
| --- | --- |
| 可行性 | **partial（部分可行）** |
| 对当前主路径（Mac/Windows 个人机 + 解压加载） | **基本解决不了痛点** |
| 对 Linux 个人机 / 企业托管 Chrome | **可行** |
| 推荐 | **现在不要把自托管 CRX 当主更新方案**；优先评估 **Chrome 商店未列出（unlisted）**，或继续解压 + 接受手动重载；日常轻量能力再开油猴 Lite |

一句话：官方自托管文档写明 **Linux 才是面向普通用户的店外托管平台**；Mac/Windows 店外安装被政策挡住，企业策略才能绕。你现在是解压装，`update_url` **根本不会跑**。

## 现状（本 fork）

- Manifest：**MV3**（`manifest.chrome.json` / `dist-chrome`）。
- 已有上游商店 **`key`**（扩展 ID 固定为 `bmdhdihdbhjbkfaaainidcjbgidkbeoh`，与 CWS 同 ID，方便 Drive OAuth）。
- **没有** `update_url`。
- 分发：GitHub Releases 上的 **zip → 加载已解压**（见 `docs/INSTALL-CHROME-zh.md`）。
- 打包脚本：出 zip / dist，**没有** CRX 签名流水线、没有 `updates.xml`。

## Chrome 规则摘要（2025–2026）

### 自动更新机制本身

1. Manifest 写 HTTPS `update_url` → 指向 Omaha 风格 `updates.xml`。
2. XML 里 `appid` + `updatecheck codebase=…crx` + `version`；CRX 须用**同一把 PEM** 签名。
3. Chrome 每隔数小时轮询；可在 `chrome://extensions` 点「更新」强制检查。
4. MV3：扩展空闲时才装更新（service worker 停、无扩展页打开）。
5. **解压（Load unpacked）安装：不走这套自动更新。** 只有「已安装的打包扩展」才会按 `update_url` 拉新。

### 平台 / 政策（关键 blocker）

| 场景 | 店外 CRX + 自托管 update | 说明 |
| --- | --- | --- |
| Linux 个人 | ✅ 官方支持 | [Self-host for Linux](https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux) |
| Mac / Windows 个人（外部偏好/注册表预装） | ❌ | 外部安装的 `update_URL` **必须**指向 Chrome Web Store |
| Mac / Windows 企业托管 | ✅（策略） | `ExtensionSettings` / force_install + 自有 `update_url` |
| Mac / Windows 开发者模式拖 CRX | 灰区 | UI 仍接受拖放 `.crx`；**不能当作**稳定的「装一次永远自动更新」产品路径；政策与商店外分发限制仍在 |
| 解压加载（我们现状） | ❌ 无自动更新 | 与 `update_url` 无关 |

### 首次安装

即使自托管在 Linux 上跑通，**第一次仍要手动装**（点链接 / 拖 CRX / 外部 JSON）。不会变成油猴那种「脚本页一点就装」。

## GitHub Releases 当托管？

- `https://github.com/<repo>/releases/latest/download/<file>` 可作稳定 URL，社区有人用（CRX + `updates.xml` 同挂 Release）。
- 实测本仓 Release 资产最终响应：`Content-Type: application/octet-stream`（在 Chrome 允许列表内）；最终 CDN 响应未见 `nosniff`（中间 github.com 302 带 nosniff，一般跟到最终 URL 即可）。
- 风险：点击安装（当「可安装链接」）对 header 更挑；**自动更新下载**相对宽松。仍建议 MVP 时用真机点一次「更新」验证；若失败再套 Cloudflare/Worker 定死 `application/x-chrome-extension`。
- CORS：Chrome 更新检查是浏览器原生请求，**不是页面 XHR**，一般不卡 CORS。

## 若硬做：本 fork 的工作流（对照现状）

```
现状：bump → build zip → Release → 用户解压覆盖 → 点「重新加载」
目标：bump → build → 固定 PEM 签 CRX → 写 updates.xml → Release
      → 仅「已用同 PEM 装过的打包扩展」才可能自动升
```

还要额外处理：

1. **换自己的 PEM / 扩展 ID**（不要继续用上游商店 `key`），否则与 CWS 原版同 ID 冲突；Drive `identity` OAuth 也绑在原 ID 上 → fork 要自建 OAuth 客户端或暂时接受 Drive 不可用。
2. 用户从「解压」迁到「打包 CRX」：卸旧装新，一次性。
3. PEM 进 CI Secret，丢了就不能平滑升级（扩展 ID 变）。

## 工作量粗估

| 范围 | 估时 | 备注 |
| --- | --- | --- |
| 文档级探路（本任务） | 已完成 | — |
| 技术 MVP：签 CRX + xml + Release 脚本 | **0.5–1 天** | 不含政策绕过 |
| 真机验证（Mac 个人 Chrome） | **可能直接 fail / 不稳定** | 主风险 |
| Linux 真机验证 | 半天内 | 政策允许 |
| 企业策略文档（个人机不推荐） | 半天 | 过重 |
| **真正解决 Mac 更新痛** | 另开：unlisted CWS 或油猴 Lite | 见下 |

## 方案对比（推荐顺序）

1. **Chrome 商店未列出（unlisted）** — Mac/Windows 正规自动更新；首次一点装；日常迭代仍可保留 zip 给自己。代价：开发者账号、审核、改完要传包（比解压慢，但比「用户每次手动」好）。
2. **维持解压 + 降摩擦** — 固定目录覆盖 + 扩展页「重新加载」；文档已有三步图。零政策风险，痛点只减半。
3. **油猴 Lite（后置）** — 只带阅读器跟人走 / 大纲钉住 / 软刷新等日常能力；更新体验接近油猴。不全功能。
4. **自托管 CRX** — 仅当目标用户是 Linux，或你愿意上企业策略时再做；**不建议作为当前个人 Mac 主路径**。

## 给 Violet 的开放问题

1. 用户主用系统是 **Mac / Windows / Linux**？若是 Mac/Windows，是否接受 **先走 unlisted 商店** 而不是自托管？
2. Drive 备份在 fork 里是否必须？若自托管换 ID，是否接受暂时关掉 / 另配 OAuth？
3. 「更新麻烦」是否主要指：**你（开发）每次要用户操作**，还是用户端日常？若只是开发者本人，固定 `dist-chrome` 目录 + Reload 是否够用？
4. 若自托管仅作 Linux/实验通道，是否值得花半天搭流水线，还是直接跳到 unlisted / 油猴 Lite？

## 非目标（本探路）

- 不实现 CRX 打包、不写 CI、不改 manifest `update_url`。
- 不实现油猴 Lite。
- 不注册 / 不提交 Chrome Web Store。

## 参考

- https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux
- https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions
- https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle
- 社区示例：GitHub Releases 挂 CRX + `updates.xml`（如 mxid-extension / bruvtab 类流水线）
