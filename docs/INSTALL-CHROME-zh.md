# MarkDone（veightz）Chrome 三步安装

未上架开发包，不能用商店「一点安装」。按下面做即可。

## 准备

- 下载 Release 里的 zip（例如 [fork-6.0.0-dev.2](https://github.com/veightz/AI-MarkDone/releases/tag/fork-6.0.0-dev.2)）
- **关掉或卸掉** Chrome 商店版 AI-MarkDone（两个一起开会抢同一页）

## 三步

### 1. 解压 zip

双击解压。打开解压后的文件夹，确认**这一层**就能看到 `manifest.json`（不要多套一层空目录）。

### 2. 打开扩展页并开开发者模式

地址栏打开：`chrome://extensions`  
右上角打开 **开发者模式**。

### 3. 加载已解压的扩展程序

点 **加载已解压的扩展程序** → 选中上一步那个含 `manifest.json` 的文件夹。

之后改版：再下新 zip，解压覆盖（或加载新目录），在扩展页点该扩展的 **重新加载**。

## 商店未列出（推荐日常）

日常自动更新请走 **Chrome 商店未列出**（材料见 `docs/chrome-store/`）。本页解压步骤保留给开发 / 应急。

## 不用改什么

- 不用换插件 ID  
- 不用改 `manifest` 里的 key  
