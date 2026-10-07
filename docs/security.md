# Security Documentation

## Overview

This document describes the security architecture, threat model, and security controls implemented in the Patient-Centric Blockchain Healthcare Data Sharing System.

## Threat Model

### Assets to Protect
1. **Medical Records** - Highly sensitive patient health information
2. **Patient Identity** - Wallet addresses linked to real identities
3. **Consent Decisions** - Immutable access control decisions
4. **Audit Trail** - Tamper-proof system activity logs
5. **Encryption Keys** - Master keys for file encryption

### Threat Actors
| Actor | Capabilities | Motivation |
|-------|-------------|------------|
| External Attacker | Network access, phishing, exploits | Data theft, ransomware |
| Malicious Insider | Legitimate access, elevated privileges | Data exfiltration, sabotage |
| Compromised Device | Malware, keyloggers | Credential theft |
| Curious Doctor | Legitimate access, social engineering | Unauthorized record access |
| Malicious Patient | Legitimate access | Denial of service, false records |

### Attack Vectors
- Smart contract vulnerabilities
- API injection attacks
- Man-in-the-middle (MITM)
- Replay attacks
- Privilege escalation
- Data integrity attacks

## Security Controls

### 1. Authentication & Authorization

#### Wallet-Based Authentication
- **EIP-191 Signature Verification**: Nonce-based challenge-response
- **JWT Session Management**: Short-lived access tokens (24h), rotating refresh tokens (7d)
- **Role Determination**: From trusted database/blockchain, never frontend

```typescript
// Authentication Flow
1. Client → POST /api/auth/nonce { walletAddress }
2. Server → Returns { nonce, message }
3. Client → MetaMask.signMessage(message)
4. Client → POST /api/auth/verify { walletAddress, signature, message }
5. Server → ethers.verifyMessage(message, signature) === walletAddress
6. Server → Check user exists in DB, status = ACTIVE
7. Server → Issue JWT with role from DB
```

#### Role-Based Access Control (RBAC)
Three roles with hierarchical permissions:
```
ADMIN > PATIENT > DOCTOR (for own data)
```

**Backend Middleware:**
```typescript
requireRole('ADMIN')    // Admin-only endpoints
requireRole('PATIENT')  // Patient-only endpoints
requireRole('DOCTOR')   // Doctor-only endpoints
```

**Smart Contract Access Control:**
```solidity
// OpenZeppelin AccessControl
bytes32 ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 PATIENT_ROLE = keccak256("PATIENT_ROLE");
bytes32 DOCTOR_ROLE = keccak256("DOCTOR_ROLE");
modifier onlyRegistrar() { require(hasRole(REGISTRAR_ROLE, msg.sender), "..."); _; }
```

### 2. Data Protection

#### Encryption at Rest (Medical Files)
```
Plaintext File
      │
      ▼
SHA-256 Hash ──────► Stored on Blockchain (Integrity Proof)
      │
      ▼
AES-256-GCM Encryption
      │
      ├── Key (32 bytes) ─────► Encrypted with Master Key
      ├── IV (16 bytes) ──────► Stored in Metadata
      ├── Auth Tag (16 bytes) ┘
      │
      ▼
Encrypted File ──────► Local Storage / IPFS
```

**Key Properties:**
- Unique encryption key per file (generated via `crypto.randomBytes(32)`)
- AES-256-GCM provides confidentiality + integrity
- Master key encrypts file keys (envelope encryption)
- IV never reused (fresh per encryption)
- Auth tag prevents tampering

#### Encryption in Transit
- **HTTPS** required for production
- **WebSocket Secure (WSS)** for real-time
- **TLS 1.3** minimum

#### Data Minimization on Blockchain
**NEVER stored on-chain:**
- Medical record contents
- Diagnoses, prescriptions, images
- Personal health information (PHI)
- Encryption keys

**Only stored on-chain:**
- Wallet addresses (pseudonymous)
- Record IDs & metadata
- SHA-256 hashes (integrity)
- Storage CIDs (references)
- Consent states (PENDING/APPROVED/DENIED/REVOKED/EXPIRED)
- Audit metadata (action, actor, target, timestamp)

### 3. Consent Management Security

#### Blockchain as Source of Truth
```solidity
// ConsentManager.checkAccess() - Core verification
function checkAccess(
    address doctorAddress,
    address patientAddress,
    uint256 recordId
) external view returns (bool, uint8, uint256) {
    // Iterates all approved requests for doctor-patient pair
    // Checks: status == APPROVED
    // Checks: expiresAt == 0 || expiresAt > block.timestamp
    // Checks: access level matches requested record
    // Returns: (hasAccess, status, expiresAt)
}
```

**Backend MUST verify on every record access:**
```typescript
// Before releasing any file
const { hasAccess, status, expiresAt } = await blockchainService.checkAccess(
  doctorWallet,
  patientWallet,
  recordId
);

if (!hasAccess) {
  throw new ForbiddenError('No valid consent');
}
```

#### Consent Lifecycle Security
| State | Transitions | Security Property |
|-------|-------------|-------------------|
| PENDING | → APPROVED, DENIED | Doctor cannot access |
| APPROVED | → REVOKED, EXPIRED | Doctor CAN access |
| DENIED | (terminal) | Doctor cannot access |
| REVOKED | (terminal) | Doctor cannot access |
| EXPIRED | (terminal) | Doctor cannot access |

**Immutability**: Once APPROVED, cannot be changed to DENIED (only REVOKED)

### 4. Audit & Integrity

#### Immutable Audit Trail
Two-layer logging:
1. **Blockchain AuditLog**: Tamper-proof, append-only
2. **Database audit_logs**: Queryable, enriched with metadata

```solidity
// AuditLog.log() - Only SYSTEM_ROLE or ADMIN can call
function log(
    address actorWallet,
    string actorRole,
    uint8 action,
    string targetType,
    uint256 targetId,
    string targetIdentifier,
    uint8 status,
    string transactionHash,
    string metadata
) external onlySystemOrAuditor returns (uint256)
```

**Logged Actions:**
- USER_REGISTERED, USER_DEACTIVATED, USER_LOGIN
- RECORD_UPLOADED, RECORD_HASH_REGISTERED
- ACCESS_REQUESTED, ACCESS_APPROVED, ACCESS_DENIED, ACCESS_REVOKED
- RECORD_ACCESSED, RECORD_DOWNLOADED
- ADMIN_ACTION, ROLE_ASSIGNED, EMERGENCY_ACCESS

#### File Integrity Verification
```typescript
// On every download
const { data, metadata } = await storageService.retrieveFile(cid);
const computedHash = storageService.generateFileHash(data);
if (computedHash !== record.file_hash) {
  throw new Error('File integrity check failed: hash mismatch');
}
```

### 5. Network Security

#### LAN-Only Deployment
- Ganache RPC bound to `0.0.0.0:7548` (LAN accessible)
- Backend API bound to `0.0.0.0:3000`
- Frontend dev server bound to `0.0.0.0:5173`
- **No public Internet exposure**

#### Firewall Rules (Windows)
```powershell
# Allow LAN access only (Private network profile)
New-NetFirewallRule -Name "Ganache RPC" -LocalPort 7548 -RemoteAddress 192.168.0.0/16 -Profile Private -Action Allow
New-NetFirewallRule -Name "Backend API" -LocalPort 3000 -RemoteAddress 192.168.0.0/16 -Profile Private -Action Allow
New-NetFirewallRule -Name "Frontend" -LocalPort 5173 -RemoteAddress 192.168.0.0/16 -Profile Private -Action Allow
```

#### CORS Configuration
```typescript
// Backend only accepts requests from frontend origin
cors: {
  origin: config.cors.origin, // http://SERVER_LAN_IP:5173
  credentials: true
}
```

### 6. Smart Contract Security

#### Reentrancy Protection
- OpenZeppelin `ReentrancyGuard` on state-changing functions
- Checks-effects-interactions pattern

#### Access Control
- Role-based permissions (OpenZeppelin AccessControl)
- Admin-only registration
- Patient-only consent decisions
- Doctor-only access requests

#### Input Validation
```solidity
require(walletAddress != address(0), "Invalid address");
require(bytes(name).length > 0, "Name required");
require(fileHash != bytes32(0), "Hash required");
require(expiresAt == 0 || expiresAt > block.timestamp, "Future expiry");
```

#### Integer Overflow
- Solidity 0.8.24 built-in overflow checks
- SafeMath not needed

#### Event Emission
- All state changes emit events
- Indexed parameters for efficient querying

### 7. Key Management

#### Development (Current)
```env
# .env - DEVELOPMENT ONLY
ENCRYPTION_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
BACKEND_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-characters-long
```

#### Production Requirements
| Key | Storage | Rotation |
|-----|---------|----------|
| Master Encryption Key | HSM / AWS KMS / HashiCorp Vault | 90 days |
| JWT Secret | Secret Manager | 30 days |
| Blockchain Private Key | HSM / Hardware Wallet | N/A (use multisig) |
| Database Password | Secret Manager | 90 days |

**Never:**
- Commit keys to Git
- Store keys in frontend code
- Use development keys in production
- Share keys between environments

### 8. Secure Development Practices

#### Code Review Checklist
- [ ] No hardcoded secrets
- [ ] Input validation on all endpoints
- [ ] Parameterized SQL queries
- [ ] Proper error handling (no stack traces to client)
- [ ] Rate limiting on auth endpoints
- [ ] Security headers (Helmet.js)
- [ ] Dependency vulnerability scanning

#### Dependency Management
```bash
# Regular audits
npm audit
npm audit fix

# Automated in CI
# GitHub Dependabot alerts
```

#### Secrets Detection
```bash
# Pre-commit hook
# .gitignore includes .env files
# TruffleHog / GitLeaks in CI
```

## Incident Response

### Data Breach Response
1. **Detect**: Audit log anomaly, alert
2. **Contain**: Revoke compromised keys, block IPs
3. **Assess**: Determine scope (records, users affected)
4. **Notify**: Patients, regulators (HIPAA/GDPR)
5. **Remediate**: Rotate keys, patch vulnerability
6. **Review**: Update controls, document lessons

### Key Compromise
1. Revoke compromised key immediately
2. Generate new key in HSM
3. Re-encrypt affected files (if master key)
4. Rotate JWT secret
5. Force re-authentication for all users

### Smart Contract Vulnerability
1. Pause contract (if pausable)
2. Deploy fixed version
3. Migrate data/state
4. Update frontend/backend contract addresses
5. Audit new deployment

## Compliance Considerations

### HIPAA (US Healthcare)
- **Encryption**: AES-256 at rest, TLS in transit ✓
- **Access Control**: Role-based, audit logged ✓
- **Audit Trail**: Immutable blockchain logs ✓
- **Data Integrity**: SHA-256 verification ✓
- **Breach Notification**: Audit logs enable 60-day notification ✓
- **BAA**: Required with cloud providers

### GDPR (EU)
- **Right to Access**: Patient can view own records ✓
- **Right to Rectification**: Admin can update ✓
- **Right to Erasure**: Soft delete (deactivate) ✓
- **Data Portability**: Export via API ✓
- **Privacy by Design**: Minimal on-chain data ✓
- **DPIA**: Required for production

### Regional Regulations
- **PIPEDA** (Canada)
- **LGPD** (Brazil)
- **PDPA** (Singapore/Thailand)
- **HIPAA** (US)

## Security Testing

### Automated
```bash
# Dependency scanning
npm audit

# SAST
# GitHub CodeQL / SonarQube

# Smart contract analysis
# Slither / MythX

# Secret scanning
# TruffleHog / GitLeaks
```

### Manual
- Penetration testing (annual)
- Smart contract audit (pre-mainnet)
- Key management review
- Access control verification

## Security Checklist for Production

### Infrastructure
- [ ] HTTPS/TLS 1.3 everywhere
- [ ] Database SSL enabled
- [ ] Firewall rules restrictive
- [ ] VPC/Network segmentation
- [ ] DDoS protection
- [ ] WAF enabled

### Application
- [ ] Rate limiting configured
- [ ] Security headers (CSP, HSTS, etc.)
- [ ] Input validation on all endpoints
- [ ] Error handling (no info leakage)
- [ ] Session management secure
- [ ] Password/key policies enforced

### Data
- [ ] Encryption at rest (AES-256)
- [ ] Encryption in transit (TLS)
- [ ] Key management in HSM/KMS
- [ ] Backup encryption
- [ ] Data retention policies
- [ ] Secure deletion procedures

### Blockchain
- [ ] Production-grade consensus (not Ganache)
- [ ] Multi-sig admin controls
- [ ] Contract upgradeability (if needed)
- [ ] Emergency pause mechanism
- [ ] Formal verification (critical contracts)
- [ ] Bug bounty program

### Operations
- [ ] Monitoring & alerting
- [ ] Incident response plan
- [ ] Regular security training
- [ ] Vendor risk assessment
- [ ] Compliance audits
- [ ] Penetration testing schedule

## Security Contacts

For security issues:
- **Email**: security@healthcare-blockchain.example.com
- **PGP Key**: [Available on request]
- **Response Time**: 24 hours for critical issues

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-15 | System Architect | Initial security documentation |