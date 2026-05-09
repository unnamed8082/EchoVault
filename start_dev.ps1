# EchoVault 一键启动脚本 (Windows PowerShell)
# 修复版：解决语法错误和 PowerShell 兼容性问题

$ErrorActionPreference = "Stop"

function Write-ColorOutput($message, $color) {
    Write-Host $message -ForegroundColor $color
}

Write-ColorOutput "=====================================" "Cyan"
Write-ColorOutput "  EchoVault 开发环境启动" "Cyan"
Write-ColorOutput "=====================================" "Cyan"
Write-Host ""

# 检查 Node.js
Write-ColorOutput "[1/5] 检查 Node.js..." "Yellow"
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if ($nodePath) {
    $nodeVersion = node -v
    Write-ColorOutput "  已安装: $nodeVersion" "Green"
} else {
    Write-ColorOutput "  错误: 未找到 Node.js，请先安装 Node.js" "Red"
    Read-Host "按回车键退出..."
    exit 1
}

# 检查 Python
Write-ColorOutput "[2/5] 检查 Python..." "Yellow"
$pythonPath = Get-Command python -ErrorAction SilentlyContinue
if ($pythonPath) {
    $pythonVersion = python --version 2>&1
    Write-ColorOutput "  已安装: $pythonVersion" "Green"
} else {
    Write-ColorOutput "  警告: 未找到默认 Python，尝试项目指定路径..." "Yellow"
    $customPython = "E:\ABB_Spray_Project\NodeJS\python.exe"
    if (Test-Path $customPython) {
        $pythonVersion = & $customPython --version 2>&1
        Write-ColorOutput "  已安装: $pythonVersion" "Green"
        $env:PATH = "E:\ABB_Spray_Project\NodeJS;" + $env:PATH
    } else {
        Write-ColorOutput "  错误: 未找到 Python，请安装 Python 或确认路径" "Red"
        Read-Host "按回车键退出..."
        exit 1
    }
}

# 检查 .env
Write-ColorOutput "[3/5] 检查环境配置..." "Yellow"
if (!(Test-Path ".env")) {
    Write-ColorOutput "  警告: 未找到 .env，从模板复制..." "Yellow"
    Copy-Item ".env.example" ".env" -Force
    Write-ColorOutput "  成功: 已创建 .env，如需修改请编辑此文件" "Green"
} else {
    Write-ColorOutput "  成功: .env 存在" "Green"
}

# 启动后端
Write-ColorOutput "[4/5] 启动后端服务 (端口 9000)..." "Yellow"

$backendJob = Start-Job -ScriptBlock {
    Set-Location "backend"
    if (!(Test-Path "venv")) {
        Write-Host "  创建虚拟环境..."
        python -m venv venv
    }
    . .\venv\Scripts\Activate.ps1
    Write-Host "  安装依赖..."
    pip install -q -r requirements.txt
    Write-Host "  运行后端..."
    python -m uvicorn src.main:app --host 0.0.0.0 --port 9000 --reload
}

Start-Sleep -Seconds 5
Write-ColorOutput "  成功: 后端已启动" "Green"

# 启动前端
Write-ColorOutput "[5/5] 启动前端服务 (端口 3000)..." "Yellow"
Set-Location "frontend"
if (!(Test-Path "node_modules")) {
    Write-Host "  安装依赖..."
    npm install
}
Write-Host "  运行前端..."
Write-Host ""
Write-ColorOutput "=====================================" "Cyan"
Write-ColorOutput "  服务启动完成！" "Cyan"
Write-ColorOutput "=====================================" "Cyan"
Write-ColorOutput "  前端: http://localhost:3000" "Green"
Write-ColorOutput "  后端: http://localhost:9000" "Green"
Write-ColorOutput "  API文档: http://localhost:9000/docs" "Green"
Write-ColorOutput "=====================================" "Cyan"
Write-Host ""

npm run dev
