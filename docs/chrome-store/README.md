# Chrome Web Store（Unlisted）材料

个人改版 **MarkDone（veightz）** 上架用文案与清单。Visibility = **Unlisted**。

| 文件 | 用途 |
| --- | --- |
| [STORE-LISTING-zh.md](./STORE-LISTING-zh.md) | 中文名称 / 简述 / 详述 |
| [STORE-LISTING-en.md](./STORE-LISTING-en.md) | English listing |
| [PERMISSIONS.md](./PERMISSIONS.md) | 权限与 Privacy practices |
| [PRIVACY-POLICY.md](./PRIVACY-POLICY.md) | 隐私政策正文（需再挂公网 URL） |
| [EXTENSION-ID-AND-KEY.md](./EXTENSION-ID-AND-KEY.md) | 为何去掉上游 key、新 ID 与 Drive OAuth |

任务与人工步骤：`.trellis/tasks/10-08-chrome-store-unlisted/prd.md`

上传 zip（构建产物，通常不进 git）：去掉 `manifest.key`、无 `update_url`，示例路径  
`/workspace/releases/AI-MarkDone-veightz-chrome-store-unlisted.zip`。

Rebuild:

```bash
npm run build:chrome   # or: ./scripts/package-chrome-store-unlisted.sh
```
