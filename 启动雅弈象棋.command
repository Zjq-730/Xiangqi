#!/bin/zsh
export PATH="/Users/Zjq/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")" || exit 1

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

clear
echo "============================================"
echo "          雅弈 · 中国象棋（独立运行版）"
echo "============================================"
echo ""
echo "  本机浏览器访问：http://localhost:5173/"
if [ -n "$LAN_IP" ]; then
  echo "  手机 / iPad 同 Wi-Fi 联机：http://${LAN_IP}:5173/"
fi
echo ""
echo "  内置：Pikafish NNUE 引擎 + 双设备联机 + DeepSeek 代理"
echo "  提示：玩完直接关闭此终端窗口即可停止服务。"
echo "============================================"
echo ""

# If port 5173 is already running, just open the browser
if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "检测到服务已在运行，正在为你打开浏览器..."
  open "http://localhost:5173/"
  exit 0
fi

# Open browser automatically once Vite is up
(sleep 1.5 && open "http://localhost:5173/") &

exec npm run dev -- --port 5173
