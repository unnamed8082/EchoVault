@echo off
echo ================================
echo   EchoVault Dev Environment
echo ================================
echo.

rem Check Node.js
echo [1/5] Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    pause
    exit /b 1
)

rem Check Python
echo [2/5] Checking Python...
python --version
if %errorlevel% neq 0 (
    echo WARNING: Trying custom Python path...
    "E:\ABB_Spray_Project\NodeJS\python.exe" --version
    if %errorlevel% neq 0 (
        echo ERROR: Python not found!
        pause
        exit /b 1
    )
)

rem Check .env
echo [3/5] Checking .env...
if not exist ".env" (
    echo WARNING: .env not found, copying from template...
    copy ".env.example" ".env"
)

rem Start backend
echo [4/5] Starting backend on port 9000...
start "Backend" cmd /k "cd backend && python -m uvicorn src.main:app --host 0.0.0.0 --port 9000 --reload"

rem Wait for backend
timeout /t 5 /nobreak >nul

rem Start frontend
echo [5/5] Starting frontend on port 3000...
cd frontend
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)
echo.
echo ================================
echo   Services Started!
echo ================================
echo   Frontend: http://localhost:3000
echo   Backend: http://localhost:9000
echo   API Docs: http://localhost:9000/docs
echo ================================
echo.
npm run dev