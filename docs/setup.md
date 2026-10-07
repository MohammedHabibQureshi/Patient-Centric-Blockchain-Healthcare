# Setup Guide

## Prerequisites Installation

### Windows

#### 1. Install Node.js
```powershell
# Using Chocolatey
choco install nodejs-lts

# Or download from https://nodejs.org/
```

#### 2. Install PostgreSQL
```powershell
# Using Chocolatey
choco install postgresql

# Or download from https://www.postgresql.org/download/windows/
# Default credentials: postgres/postgres
```

#### 3. Install Git
```powershell
choco install git
```

### Linux (Ubuntu/Debian)

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Git
sudo apt-get install -y git
```

### macOS

```bash
# Using Homebrew
brew install node@18 postgresql git
```

## Project Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd patient-healthcare-blockchain
```

### 2. Install All Dependencies
```bash
npm run install:all
```

This installs dependencies for:
- Root workspace
- Frontend
- Backend
- Contracts

### 3. Configure Environment

```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### 4. Find Your LAN IP Address

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under your WiFi/Ethernet adapter
# Example: 192.168.1.100
```

**Linux/macOS:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Or: hostname -I
```

### 5. Update Environment Files

Edit `.env` in the root directory:
```env
# Replace with your actual LAN IP
SERVER_LAN_IP=192.168.1.100
```

The frontend `.env.local` and backend `.env` will automatically use this value.

### 6. Setup PostgreSQL Database

```bash
# Start PostgreSQL service
# Windows: net start postgresql-x64-14 (version may vary)
# Linux: sudo systemctl start postgresql
# macOS: brew services start postgresql

# Create database
createdb -U postgres patient_healthcare

# Or using psql
psql -U postgres -c "CREATE DATABASE patient_healthcare;"
```

### 7. Initialize Database Schema
```bash
cd backend
npm run db:init
```

This creates all tables, indexes, and extensions.

## Running the System

You need **4 terminal windows** (or tabs) running simultaneously:

### Terminal 1: Start Ganache Blockchain
```bash
npm run blockchain
```
Or directly:
```bash
cd blockchain
./start-ganache.bat
```

**Expected Output:**
```
Starting Ganache...
Configuration:
  Host:        0.0.0.0
  Port:        7545
  Chain ID:    1338
  Network ID:  1338
  Accounts:    20 (deterministic)

Available Accounts:
==================
(0) 0x90F8bf6A479f316Ea03399A3C254C30D9E1848F5 (10000 ETH)
(1) 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0 (10000 ETH)
...
(19) 0x123... (10000 ETH)

Private Keys:
==================
(0) 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
...
```

**Keep this terminal open!** Note the Account 0 private key for Admin MetaMask.

### Terminal 2: Deploy Smart Contracts
```bash
npm run deploy
```

**Expected Output:**
```
Deploying contracts...
UserRegistry deployed to: 0x...
MedicalRecordRegistry deployed to: 0x...
ConsentManager deployed to: 0x...
AuditLog deployed to: 0x...

Contract addresses saved to contracts/contracts.json
```

### Terminal 3: Start Backend API
```bash
npm run server
```

**Expected Output:**
```
Starting Patient Healthcare Backend...
Database connected successfully
Blockchain service initialized
Server running on http://0.0.0.0:3000
Environment: development
```

### Terminal 4: Start Frontend
```bash
npm run dev
```

**Expected Output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/  (your LAN IP)
  ➜  Network: http://172.x.x.x:5173/
```

## MetaMask Configuration

### 1. Install MetaMask
- **Browser**: https://metamask.io/download/
- **Mobile**: App Store / Google Play

### 2. Add Network
Click MetaMask → Add Network → Add Network Manually:

| Field | Value |
|-------|-------|
| Network Name | Patient Healthcare Blockchain |
| New RPC URL | `http://YOUR_SERVER_LAN_IP:7545` |
| Chain ID | `1338` |
| Currency Symbol | `ETH` |
| Block Explorer URL | (leave blank) |

### 3. Import Test Accounts

**Admin (Account 0):**
1. MetaMask → Import Account
2. Paste private key from Ganache Account 0:
   `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

**Patients (Accounts 1-10):**
Import private keys from Ganache output for accounts 1-10.

**Doctors (Accounts 11-19):**
Import private keys from Ganache output for accounts 11-19.

### 4. Initialize Test Users
```bash
cd contracts
npx hardhat run scripts/initialize.ts --network localhost
```

This registers:
- Admin (Account 0)
- 10 Patients (Accounts 1-10)
- 9 Doctors (Accounts 11-19)

## Verification Checklist

### ✅ Blockchain
- [ ] Ganache running on port 7545
- [ ] 20 accounts displayed
- [ ] Chain ID shows 1338
- [ ] Accounts match previous startup (deterministic)

### ✅ Smart Contracts
- [ ] 4 contracts deployed
- [ ] Addresses saved to `contracts/contracts.json`
- [ ] No deployment errors

### ✅ Database
- [ ] PostgreSQL running
- [ ] `patient_healthcare` database exists
- [ ] Tables created (run `npm run db:init` successfully)

### ✅ Backend
- [ ] Running on port 3000
- [ ] Connected to database
- [ ] Connected to blockchain
- [ ] Health check: `curl http://localhost:3000/api/health`

### ✅ Frontend
- [ ] Running on port 5173
- [ ] Accessible at `http://localhost:5173`
- [ ] Accessible at `http://YOUR_LAN_IP:5173` from other devices

### ✅ MetaMask
- [ ] Network added with correct Chain ID (1338)
- [ ] Admin account imported (Account 0)
- [ ] At least 1 patient account imported
- [ ] At least 1 doctor account imported

## Testing the Complete Workflow

### 1. Admin Login
1. Open `http://YOUR_LAN_IP:5173` on admin computer
2. Connect MetaMask (Account 0)
3. Sign authentication message
4. Should see Admin Dashboard

### 2. Register Test Users (if not done via script)
1. Admin Dashboard → Register Patient
2. Use Account 1 wallet address
3. Fill name, email, patient ID
4. Repeat for doctor with Account 11

### 3. Patient Login
1. Open `http://YOUR_LAN_IP:5173` on patient phone
2. Connect MetaMask (Patient account)
3. Sign authentication message
4. Should see Patient Dashboard

### 4. Upload Medical Record
1. Patient Dashboard → Upload Record
2. Select PDF/image file
3. Enter record name and type
4. Submit → Wait for transaction confirmation
4. Should see record in "My Records"

### 5. Doctor Login
1. Open `http://YOUR_LAN_IP:5173` on doctor phone
2. Connect MetaMask (Doctor account)
3. Sign authentication message
3. Should see Doctor Dashboard

### 6. Request Access
1. Doctor Dashboard → Search Patients
2. Find the patient
3. Click "Request Access"
4. Select record, enter reason/purpose
5. Submit → Wait for transaction

### 7. Approve Access
1. Patient Dashboard → Access Requests
2. See pending request from doctor
3. Click "Approve"
4. Sign MetaMask transaction

### 8. Access Record
1. Doctor Dashboard → Authorized Records
2. Click download on approved record
3. File should download and open

## Troubleshooting

### Ganache Won't Start
```bash
# Check if port 7545 is in use
netstat -ano | findstr :7545

# Kill existing process
taskkill /PID <PID> /F
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
# Windows: services.msc → postgresql
# Linux: sudo systemctl status postgresql

# Check credentials in backend/.env
DB_USER=postgres
DB_PASSWORD=postgres
```

### Frontend Can't Connect to Backend
- Check `VITE_API_BASE_URL` in frontend/.env.local
- Ensure it uses LAN IP, not localhost
- Check CORS_ORIGIN in backend/.env matches frontend URL

### MetaMask "Wrong Network"
- Ensure RPC URL uses LAN IP, not localhost
- Chain ID must be 1338
- Try removing and re-adding network

### Transaction Fails
- Check Ganache is running
- Check contract addresses in backend/.env match deployed
- Ensure account has ETH (Ganache gives 10000 ETH each)

### "Wallet Not Registered"
- Run initialization script: `npm run blockchain:init` in contracts folder
- Or manually register via Admin Dashboard

## Firewall Configuration (Windows)

Allow inbound connections on required ports:

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Ganache RPC" -Direction Inbound -LocalPort 7545 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Backend API" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Frontend Dev" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
```

Or use Windows Defender Firewall GUI to allow these ports.

## Resetting Everything

```bash
# Stop all processes (Ctrl+C in each terminal)

# Reset database
dropdb -U postgres patient_healthcare
createdb -U postgres patient_healthcare
cd backend && npm run db:init

# Reset blockchain (restart Ganache)

# Re-deploy contracts
npm run deploy

# Re-initialize users
cd contracts && npx hardhat run scripts/initialize.ts --network localhost

# Restart backend and frontend
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "Nonce already used" | Clear browser cache, restart backend |
| "Contract not deployed" | Check contracts/contracts.json exists |
| "Insufficient funds" | Use Ganache accounts (10000 ETH each) |
| "Wrong network" | MetaMask Chain ID must be 1338 |
| "CORS error" | backend/.env CORS_ORIGIN must match frontend URL |
| "File too large" | Increase STORAGE_MAX_FILE_SIZE in backend/.env |

## Next Steps

After successful setup:
1. Review [Architecture Documentation](architecture.md)
2. Read [MetaMask Setup Guide](metamask-setup.md)
3. Run [Testing Scenarios](testing.md)
4. Explore codebase structure