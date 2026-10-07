@echo off
REM =============================================================================
REM Ganache CLI Startup Script - Patient Healthcare Blockchain
REM =============================================================================
REM This script starts Ganache with deterministic accounts for consistent testing
REM Run this from the project root: npm run blockchain
REM =============================================================================

set PROJECT_ROOT=%~dp0..
cd /d %PROJECT_ROOT%

echo =============================================================================
echo Starting Ganache CLI - Patient Healthcare Blockchain
echo =============================================================================
echo.

REM Check if node_modules exists
if not exist node_modules (
    echo [ERROR] node_modules not found. Run 'npm install' first.
    exit /b 1
)

REM Check if ganache is installed
if not exist node_modules\.bin\ganache.cmd (
    echo [ERROR] Ganache not found. Run 'npm install' in contracts folder.
    exit /b 1
)

REM Check if Ganache is already running on port 7548
netstat -ano | findstr ":7548" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Ganache is already running on port 7548.
    echo [INFO] Stop the existing instance first if you need to restart.
    exit /b 0
)

REM Remove stale lock file if no Ganache process is running
if exist "%~dp0ganache-data\LOCK" (
    echo [INFO] Removing stale lock file...
    del /f "%~dp0ganache-data\LOCK" >nul 2>&1
)

echo Configuration:
echo   Host:        0.0.0.0
echo   Port:        7548
echo   Chain ID:    1339
echo   Network ID:  1339
echo   Accounts:    20 (deterministic)
echo   Mnemonic:    Fixed development mnemonic
echo   Block Time:  0 (instant mining)
echo.
echo   Use Ctrl+C to stop Ganache.
echo.

REM Start Ganache with deterministic configuration
npx ganache ^
    --server.host 0.0.0.0 ^
    --server.port 7548 ^
    --chain.chainId 1339 ^
    --chain.networkId 1339 ^
    --wallet.totalAccounts 20 ^
    --wallet.mnemonic "test test test test test test test test test test test junk" ^
    --miner.blockTime 0 ^
    --database.dbPath "%~dp0ganache-data" ^
    --logging.verbose
