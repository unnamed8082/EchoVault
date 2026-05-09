#!/bin/bash

# EchoVault 一键启动脚本 (Linux/Mac)

echo "====================================="
echo "  EchoVault 开发环境启动"
echo "====================================="
echo ""

# 检查 Node.js
echo "[1/5] 检查 Node.js..."
if command -v node &> /dev/null; then
    echo "  已安装: $(node -v)"
else
    echo "  ❌ 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 Python
echo "[2/5] 检查 Python..."
if command -v python3 &> /dev/null; then
    echo "  已安装: $(python3 --version)"
else
    echo "  ❌ 未找到 Python"
    exit 1
fi

# 检查 .env
echo "[3/5] 检查环境配置..."
if [ ! -f ".env" ]; then
    echo "  ⚠️  未找到 .env，从模板复制..."
    cp .env.example .env
    echo "  ✅ 已创建 .env，如需修改请编辑此文件"
else
    echo "  ✅ .env 存在"
fi

# 启动后端
echo "[4/5] 启动后端服务 (端口 9000)..."
cd backend
if [ ! -d "venv" ]; then
    echo "  创建虚拟环境..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
echo "  运行后端..."
python -m uvicorn src.main:app --host 0.0.0.0 --port 9000 --reload &
BACKEND_PID=$!
cd ..
sleep 5
echo "  ✅ 后端已启动"

# 启动前端
echo "[5/5] 启动前端服务 (端口 3000)..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "  安装依赖..."
    npm install
fi
echo ""
echo "====================================="
echo "  服务启动完成！"
echo "====================================="
echo "  前端: http://localhost:3000"
echo "  后端: http://localhost:9000"
echo "  API文档: http://localhost:9000/docs"
echo "====================================="
echo ""
npm run dev
wait
