# 雅弈 · 中国象棋 — 公网部署指南

本项目已经打包好 **独立生产服务器**（`server/prodServer.mjs`）与 **多阶段 `Dockerfile`**，一次部署即可同时获得：
- 24 小时公网 `https://` 网址（手机 / iPad / 任何电脑随时访问）
- 云端原生 **Pikafish NNUE** 顶级神经网络象棋引擎
- **双设备异地联机房间**（SSE 实时同步，不限同一 Wi-Fi）
- **DeepSeek 私教 & 复盘流式代理**
- **手机 PWA 桌面 App**（iPhone Safari 点「分享 → 添加到主屏幕」即可全屏运行）

---

## 第一步：把代码传到私有 GitHub 仓库（不用开源）

在终端进入项目目录 `/Users/Zjq/Documents/Gemini/xiangqi`：

```bash
git init
git add .
git commit -m "Initial commit: 雅弈中国象棋"
```

在 GitHub 新建一个 **Private（私有）** 仓库（例如 `xiangqi`），按页面提示关联并推送：

```bash
git branch -M main
git remote add origin https://github.com/你的用户名/xiangqi.git
git push -u origin main
```

> `.gitignore` 已自动排除 `node_modules/` 和本地 macOS 版 `engine-bin/`，推送只需几秒；云端构建 Docker 时会自动编译对应架构的 Linux 版 Pikafish NNUE。

---

## 第二步：一键部署到云平台（任选其一）

### 方案 A：Render.com（支持免费套餐）
1. 注册/登录 [render.com](https://render.com) 并授权你的 GitHub。
2. 点击 **New + → Web Service**，选择你刚建的私有仓库 `xiangqi`。
3. 配置项：
   - **Language / Runtime**：`Docker`（会自动识别项目里的 `Dockerfile`）
   - **Instance Type**：选择 `Free`（或 Starter）
4. 点 **Create Web Service**，等待 3～5 分钟自动编译完成，即可获得永久网址 `https://你的服务名.onrender.com`！

### 方案 B：Railway / Zeabur（体验丝滑、冷启动快）
1. 登录 [railway.app](https://railway.app) 或 [zeabur.com](https://zeabur.com)。
2. 选择 **Deploy from GitHub repo** → 选中 `xiangqi`。
3. 平台会自动检测 `Dockerfile` 构建并分配 `https://` 公网域名。

### 方案 C：国内阿里云 / 腾讯云轻量应用服务器（国内直连延迟最低）
在装好 Docker 的 Linux 服务器上拉取代码后直接运行：

```bash
docker build -t xiangqi .
docker run -d --name xiangqi --restart unless-stopped -p 3000:3000 xiangqi
```

放行 3000 端口（或用 Nginx / Caddy 反代绑定域名并开 HTTPS）即可使用。

---

## 手机端变成独立 App

用手机浏览器打开部署好的 `https://` 网址后：
- **iPhone Safari**：点底部「分享」按钮 → **「添加到主屏幕」**；
- **Android Chrome**：点右上角菜单 → **「添加到主屏幕 / 安装应用」**。

桌面就会出现一个红印章 **「弈」** 图标，点开直接全屏下棋！
