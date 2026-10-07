# System Architecture Documentation

## Overview

This document describes the complete architecture of the Patient-Centric Blockchain Healthcare Data Sharing System.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            ADMIN / SERVER COMPUTER                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                        LOCAL AREA NETWORK (LAN)                              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │    │
│  │  │ Ganache  │  │ Backend  │  │Database  │  │ Storage  │  │ Frontend │       │    │
│  │  │ :7548    │◄─┤ API :3000│◄─┤PostgreSQL│◄─┤ Encrypted│  │  :5173   │       │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                                 │
└────────────────────────────────────┼────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             ┌───────────┐    ┌───────────┐    ┌───────────┐
             │  Patient  │    │  Doctor   │    │  Admin    │
             │  Phone    │    │  Phone    │    │  Computer │
             │+ MetaMask │    │+ MetaMask │    │+ MetaMask │
             └───────────┘    └───────────┘    └───────────┘
```

## Component Details

### 1. Blockchain Layer (Ganache)

**Configuration:**
- Host: `0.0.0.0` (LAN accessible)
- Port: `7548`
- Chain ID: `1339`
- Network ID: `1339`
- Accounts: 20 deterministic
- Mnemonic: Fixed development mnemonic
- Block Time: 0 (instant mining)

**Smart Contracts (Deployment Order):**
1. **UserRegistry** - Identity and role management
2. **MedicalRecordRegistry** - Medical record metadata
3. **ConsentManager** - Access control and consent
4. **AuditLog** - Immutable audit trail

### 2. Backend API (Express/TypeScript)

**Architecture:**
```
src/
├── config/          # Configuration management
├── controllers/     # Request handlers
├── services/        # Business logic
├── middleware/      # Auth, validation, error handling
├── routes/          # API route definitions
├── blockchain/      # Blockchain service (ethers.js)
├── storage/         # File encryption/storage
├── database/        # PostgreSQL connection & queries
├── utils/           # Helpers (logger, crypto)
└── types/           # TypeScript interfaces
```

**Key Services:**
- **Auth Service**: Wallet signature verification, JWT management
- **Blockchain Service**: Contract interactions, transaction management
- **Storage Service**: AES-256-GCM encryption, file management
- **Database Service**: PostgreSQL connection pool, queries

**API Endpoints:**

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/nonce`, `POST /api/auth/verify`, `GET /api/auth/me` |
| Users (Admin) | `POST /api/users/patients`, `POST /api/users/doctors`, `GET /api/users` |
| Records | `POST /api/records`, `GET /api/records`, `GET /api/records/:id/download` |
| Access | `POST /api/access/request`, `GET /api/access/requests`, `POST /api/access/requests/:id/approve` |
| Audit | `GET /api/audit/logs`, `GET /api/audit/health` |

### 3. Database Schema (PostgreSQL)

**Tables:**

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    wallet_address VARCHAR(42) UNIQUE,
    role VARCHAR(20), -- ADMIN, PATIENT, DOCTOR
    email VARCHAR(255),
    identifier VARCHAR(100), -- Patient ID or License Number
    status VARCHAR(20), -- ACTIVE, INACTIVE, SUSPENDED
    blockchain_user_id BIGINT,
    registered_by UUID REFERENCES users(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Medical Records
CREATE TABLE medical_records (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES users(id),
    record_type VARCHAR(30),
    record_name VARCHAR(255),
    file_hash VARCHAR(64), -- SHA-256
    storage_cid VARCHAR(255), -- IPFS CID or local reference
    file_size BIGINT,
    mime_type VARCHAR(100),
    blockchain_record_id BIGINT,
    is_active BOOLEAN,
    uploaded_at TIMESTAMP
);

-- Access Requests
CREATE TABLE access_requests (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES users(id),
    doctor_id UUID REFERENCES users(id),
    record_id UUID REFERENCES medical_records(id),
    reason TEXT,
    purpose TEXT,
    access_level VARCHAR(20),
    status VARCHAR(20), -- PENDING, APPROVED, DENIED, REVOKED, EXPIRED
    blockchain_request_id BIGINT,
    requested_at TIMESTAMP,
    decided_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Consents (mirror of blockchain state)
CREATE TABLE consents (
    id UUID PRIMARY KEY,
    access_request_id UUID REFERENCES access_requests(id),
    patient_id UUID REFERENCES users(id),
    doctor_id UUID REFERENCES users(id),
    record_id UUID REFERENCES medical_records(id),
    status VARCHAR(20),
    expires_at TIMESTAMP,
    blockchain_tx_hash VARCHAR(66)
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    actor_wallet VARCHAR(42),
    actor_role VARCHAR(20),
    action VARCHAR(50),
    target_type VARCHAR(50),
    target_id UUID,
    status VARCHAR(20),
    transaction_hash VARCHAR(66),
    metadata JSONB,
    timestamp TIMESTAMP,
    block_number BIGINT
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    reference_type VARCHAR(50),
    reference_id UUID,
    is_read BOOLEAN,
    created_at TIMESTAMP
);
```

### 4. Frontend (React/TypeScript/Vite)

**Structure:**
```
src/
├── components/      # Reusable UI components
├── pages/           # Page components
│   ├── admin/       # Admin dashboard pages
│   ├── patient/     # Patient dashboard pages
│   └── doctor/      # Doctor dashboard pages
├── hooks/           # Custom React hooks
├── services/        # API & Web3 services
├── contexts/        # React contexts (Auth, Wallet)
├── types/           # TypeScript types
└── utils/           # Helpers
```

**Key Contexts:**
- **AuthContext**: User authentication state, tokens
- **WalletContext**: MetaMask connection, network status

**Pages:**
- LoginPage - Wallet connection & authentication
- AdminDashboard - System management, user registration
- PatientDashboard - Records, upload, access requests
- DoctorDashboard - Patient search, access requests, authorized records

### 5. Storage Layer

**Encryption Process:**
```
Medical File
    │
    ▼
SHA-256 Hash ──────────► Stored on Blockchain (integrity)
    │
    ▼
AES-256-GCM Encryption
    │
    ├── Key (32 bytes) ─────► Encrypted with master key
    ├── IV (16 bytes) ──────► Stored in metadata
    ├── Auth Tag (16 bytes) ┘
    │
    ▼
Encrypted File ──────────► Local Storage / IPFS
    │
    ▼
CID/Reference ──────────► Stored in Database & Blockchain
```

**Security Properties:**
- Files never stored in plaintext
- Unique encryption key per file
- Integrity verified on every access
- Master key never exposed to frontend

### 6. Smart Contracts

#### UserRegistry.sol
- Role-based access control (OpenZeppelin)
- Admin-only registration of patients/doctors
- User status management (ACTIVE/SUSPENDED)
- Events: `UserRegistered`, `UserStatusChanged`, `RoleAssigned`

#### MedicalRecordRegistry.sol
- Metadata-only storage (hash, CID, timestamps)
- Patient-record association
- Integrity verification
- Events: `MedicalRecordRegistered`, `MedicalRecordUpdated`

#### ConsentManager.sol
- Access request creation (doctor → patient)
- Approve/Deny/Revoke workflows
- Expiration support
- On-chain consent verification (`checkAccess`)
- Events: `AccessRequested`, `AccessApproved`, `AccessDenied`, `AccessRevoked`, `AccessExpired`

#### AuditLog.sol
- Immutable action logging
- Actor, action, target, status, metadata
- Query by actor, action, target, time range
- Events: `AuditLogged`

## Data Flow Examples

### Medical Record Upload
```
1. Patient selects file in UI
2. Frontend sends to Backend API
3. Backend validates file type/size
4. Backend generates SHA-256 hash
5. Backend encrypts with AES-256-GCM
6. Backend stores encrypted file locally
7. Backend gets CID/reference
8. Backend calls MedicalRecordRegistry.registerRecord()
9. Blockchain returns recordId
10. Backend saves metadata to PostgreSQL
11. Backend logs to AuditLog
12. Frontend shows success with tx hash
```

### Doctor Access Request
```
1. Doctor searches for patient
2. Doctor submits access request with reason
3. Backend creates AccessRequest in DB
4. Backend calls ConsentManager.requestAccess()
5. Blockchain emits AccessRequested event
6. Backend creates notification for patient
7. Patient sees request in dashboard
8. Patient clicks Approve
9. Frontend requests MetaMask signature
10. Frontend calls ConsentManager.approveAccess()
11. Blockchain emits AccessApproved event
12. Backend updates request status
13. Backend creates Consent record
14. Doctor can now access record
```

### Record Access Verification
```
1. Doctor clicks download on authorized record
2. Frontend calls Backend /records/:id/download
3. Backend verifies doctor authentication
4. Backend calls ConsentManager.checkAccess()
5. Blockchain returns (hasAccess, status, expiresAt)
6. If authorized: Backend retrieves encrypted file
7. Backend decrypts file
8. Backend verifies SHA-256 hash matches
9. Backend returns file to frontend
10. Backend logs RECORD_ACCESSED to AuditLog
```

## Security Model

### Trust Boundaries
- **Frontend**: Untrusted - never makes auth decisions
- **Backend**: Trusted - enforces auth, validates blockchain state
- **Blockchain**: Source of truth for identity, consent, audit
- **Database**: Application state, mirrors blockchain for queries
- **Storage**: Encrypted files, accessed only after authorization

### Authentication Flow
```
1. User enters wallet address
2. Backend generates nonce
3. Frontend asks MetaMask to sign message
4. Backend verifies signature recovers address
5. Backend checks user exists in DB & is ACTIVE
6. Backend issues JWT (access + refresh tokens)
7. Role determined from DB (not frontend)
```

### Authorization Checks
- Every protected endpoint: `authenticateToken` middleware
- Role-specific endpoints: `requireRole('ADMIN'|'PATIENT'|'DOCTOR')`
- Record access: Backend calls `ConsentManager.checkAccess()` before release
- Admin actions: Verified via `UserRegistry.hasRole(ADMIN_ROLE)`

## Network Configuration

### Server (Admin Computer)
- Listens on `0.0.0.0` for all services
- Firewall rules for ports: 7548 (Ganache), 3000 (API), 5173 (Frontend)

### Client (Patient/Doctor Phones)
- Connect to `http://SERVER_LAN_IP:5173`
- MetaMask RPC: `http://SERVER_LAN_IP:7548`
- Same LAN/WiFi network required

### Network Discovery
```bash
# Windows
ipconfig | findstr IPv4

# Linux/Mac
ifconfig | grep "inet " | grep -v 127.0.0.1
```

## Deployment Checklist

- [ ] PostgreSQL installed and database created
- [ ] Environment variables configured (especially LAN IP)
- [ ] Ganache started with deterministic accounts
- [ ] Smart contracts deployed
- [ ] Contract addresses saved to config
- [ ] Database initialized
- [ ] Backend started
- [ ] Frontend started with `--host 0.0.0.0`
- [ ] MetaMask configured on all devices
- [ ] Test accounts imported to MetaMask
- [ ] End-to-end workflow verified