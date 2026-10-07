# Patient-Centric Blockchain Healthcare Data Sharing System

A complete, end-to-end blockchain-based healthcare data sharing system that enables patients to control access to their medical records through a decentralized consent management system.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ADMIN / SERVER COMPUTER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Ganache    │  │   Backend    │  │  Database    │  │   Storage    │   │
│  │  Blockchain  │◄─┤   API Server │◄─┤ (PostgreSQL) │◄─┤ (Encrypted)  │   │
│  │   Node       │  │  (Express)   │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                  │                                         │
│                    Local Network / LAN                                     │
│                                  │                                         │
│         ┌────────────────────────┼────────────────────────┐               │
│         │                        │                        │               │
│  ┌──────▼──────┐          ┌─────▼─────┐           ┌──────▼──────┐       │
│  │  Patient    │          │  Doctor   │           │   Admin     │       │
│  │  Phone      │          │  Phone    │           │  Dashboard  │       │
│  │  + MetaMask │          │  + MetaMask           │  + MetaMask │       │
│  └─────────────┘          └───────────┘           └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Key Features

- **Patient-Centric Control**: Patients fully control who can access their medical records
- **Blockchain-Based Consent**: Immutable consent management on Ethereum-compatible blockchain
- **Encrypted Off-Chain Storage**: Medical files encrypted with AES-256 before storage
- **MetaMask Integration**: Web3 authentication using wallet signatures
- **Role-Based Access**: Admin, Patient, and Doctor roles with different permissions
- **Audit Trail**: Complete immutable audit log of all actions
- **LAN Accessibility**: Designed for local network deployment with mobile MetaMask support
- **Deterministic Blockchain**: Fixed Ganache accounts for consistent testing

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Ganache CLI (Ethereum-compatible), Solidity 0.8.24, Hardhat |
| **Smart Contracts** | OpenZeppelin AccessControl, Custom contracts |
| **Backend** | Node.js, Express, TypeScript, PostgreSQL |
| **Frontend** | React 18, TypeScript, Vite, React Router |
| **Web3** | ethers.js v6, MetaMask |
| **Storage** | AES-256-GCM encrypted local storage |
| **Database** | PostgreSQL with UUID, JSONB support |

## 📋 Prerequisites

- **Node.js** ≥ 18.0.0
- **PostgreSQL** ≥ 14
- **MetaMask** browser extension or mobile app
- **Git**

## 🔧 Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd patient-healthcare-blockchain
npm run install:all
```

### 2. Configure Environment

```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

**Important**: Edit `.env` and set your server's LAN IP address:
```bash
# Find your LAN IP (run on server computer)
# Windows: ipconfig
# Linux/Mac: ifconfig | grep inet

# Update .env with your actual LAN IP
SERVER_LAN_IP=192.168.1.100
```

### 3. Start PostgreSQL Database

```bash
# Create database
createdb patient_healthcare

# Or using psql
psql -U postgres -c "CREATE DATABASE patient_healthcare;"
```

### 4. Initialize Database Schema

```bash
cd backend
npm run db:init
```

## 🏃 Running the System

### Start All Services (in separate terminals)

**Terminal 1 - Blockchain (Ganache):**
```bash
npm run blockchain
# OR
cd blockchain && ./start-ganache.bat
```

**Terminal 2 - Deploy Smart Contracts:**
```bash
npm run deploy
```

**Terminal 3 - Backend API:**
```bash
npm run server
```

**Terminal 4 - Frontend:**
```bash
npm run dev
```

### Access the Application

- **Admin/Server Computer**: http://localhost:5173
- **Patient/Doctor Phones**: http://YOUR_SERVER_LAN_IP:5173

## 🔐 MetaMask Configuration

Add the private network to MetaMask:

| Field | Value |
|-------|-------|
| Network Name | Patient Healthcare Blockchain |
| RPC URL | `http://YOUR_SERVER_LAN_IP:7548` |
| Chain ID | `1339` |
| Currency Symbol | `ETH` |
| Block Explorer | (leave blank) |

## 🔐 Development Accounts

Ganache generates 20 deterministic **development blockchain accounts** on startup using a fixed mnemonic:

| Account | Purpose |
|---------|---------|
| Account 0 | System/backend automation wallet (admin) |
| Accounts 1-19 | Development wallets (available to sign into MetaMask) |

> **Important:** Ganache accounts are **blockchain development accounts only**. They are **NOT** automatically patients, doctors, or application users. Application users (Patients/Doctors) are created **only** through the Admin registration workflow on the `/dashboard/patients` and `/dashboard/doctors` pages. The Patients/Doctors lists start empty and are populated only by explicit Admin registration.

### Import Test Accounts to MetaMask

1. Start Ganache (`npm run blockchain`)
2. Copy private keys from Ganache output
3. In MetaMask: Import Account → Paste private key
4. Add the network configuration above

**Default Private Keys (Development Only):**
```
Account 0 (Admin): 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Account 1 (Patient 1): 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
... (see Ganache output for all 20)
```

⚠️ **NEVER use these keys in production!**

## 📖 User Workflows

### Admin Workflow
1. Connect MetaMask (Account 0)
2. Access Admin Dashboard
3. Register Patients (Accounts 1-10)
4. Register Doctors (Accounts 11-19)
5. Monitor system via Audit Logs

### Patient Workflow
1. Connect MetaMask (Patient account)
2. Upload medical records (PDF, JPG, PNG, etc.)
3. View access requests from doctors
4. Approve/Deny access requests
5. Revoke previously granted access
4. View audit trail

### Doctor Workflow
1. Connect MetaMask (Doctor account)
2. Search for patients
3. Request access to medical records
4. View authorized records
5. Download/view permitted records

## 🔒 Security Features

- **Wallet Authentication**: Nonce-based EIP-191 signature verification
- **JWT Sessions**: Secure access/refresh token pattern
- **Role-Based Access Control**: Both backend and smart contract level
- **File Encryption**: AES-256-GCM encryption before storage
- **Integrity Verification**: SHA-256 hashes stored on-chain
- **Consent Immutability**: Blockchain as source of truth for permissions
- **Audit Logging**: All critical actions recorded on-chain and in database

## 📁 Project Structure

```
patient-healthcare-blockchain/
├── blockchain/
│   └── start-ganache.bat          # Ganache startup script
├── contracts/                     # Smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── UserRegistry.sol
│   │   ├── MedicalRecordRegistry.sol
│   │   ├── ConsentManager.sol
│   │   └── AuditLog.sol
│   ├── scripts/
│   │   ├── deploy.ts
│   │   └── initialize.ts
│   └── test/
├── backend/                       # Express API
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── blockchain/
│   │   ├── storage/
│   │   ├── database/
│   │   ├── utils/
│   │   └── types/
│   └── package.json
├── frontend/                      # React Application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   ├── utils/
│   │   └── contexts/
│   └── package.json
├── database/
│   └── schema/
├── docs/
│   ├── architecture.md
│   ├── setup.md
│   ├── metamask-setup.md
│   └── testing.md
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 🧪 Testing

```bash
# Smart contract tests
cd contracts && npm test

# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# All tests
npm test
```

## 📜 Smart Contract Addresses

After deployment, contract addresses are saved to `contracts/contracts.json`:

```json
{
  "chainId": 1339,
  "UserRegistry": "0x...",
  "MedicalRecordRegistry": "0x...",
  "ConsentManager": "0x...",
  "AuditLog": "0x..."
}
```

## 🔧 Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend port | 3000 |
| `HOST` | Backend host | 0.0.0.0 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `RPC_URL` | Ganache RPC URL | http://localhost:7548 |
| `CHAIN_ID` | Blockchain chain ID | 1339 |
| `JWT_SECRET` | JWT signing secret | (required) |
| `ENCRYPTION_MASTER_KEY` | AES-256 master key (hex) | (required) |

### Frontend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | http://localhost:3000/api |
| `VITE_RPC_URL` | Blockchain RPC URL (LAN: http://10.32.2.56:7548) | http://10.32.2.56:7548 |
| `VITE_CHAIN_ID` | Chain ID | 1339 |

## 🚨 Production Considerations

This is a **development/academic prototype**. For production deployment:

1. **Replace Ganache** with production blockchain (Quorum, Besu, Hyperledger Besu)
2. **Use HTTPS** with valid TLS certificates
3. **Secure Key Management**: Use HSM/KMS for encryption keys
4. **Database Security**: Enable SSL, use connection pooling
5. **Rate Limiting**: Configure appropriate limits
6. **Monitoring**: Add logging, metrics, alerting
7. **Compliance**: HIPAA, GDPR, local healthcare regulations
8. **Backup/Recovery**: Implement disaster recovery procedures

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📞 Support

For issues and questions, please open a GitHub issue.

---

**Built with ❤️ for patient-centric healthcare data sovereignty**