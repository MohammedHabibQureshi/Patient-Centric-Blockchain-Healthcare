# Workflow Documentation

This document details the complete user workflows for the Patient-Centric Blockchain Healthcare Data Sharing System.

## Actor Roles

| Role | Description | Dashboard |
|------|-------------|-----------|
| **Admin** | System administrator, manages users and system | `/dashboard` |
| **Patient** | Owns medical records, controls access | `/patient` |
| **Doctor** | Requests access to patient records | `/doctor` |

## Authentication Flow

### All Users
```
1. Open http://SERVER_LAN_IP:5173
2. Click "Connect MetaMask"
3. Select appropriate account in MetaMask
4. MetaMask prompts to sign authentication message
5. Click "Sign" in MetaMask
6. System verifies signature
7. Redirected to role-appropriate dashboard
```

**MetaMask Signing Message Format:**
```
Patient Healthcare Blockchain Authentication

Wallet: 0x90F8bf6A479f316Ea03399A3C254C30D9E1848F5
Nonce: a1b2c3d4e5f6...
Timestamp: 1705312800000
```

## Admin Workflows

### A1: Initial System Setup
```
Prerequisites: Ganache running, contracts deployed, backend/frontend started

1. Login as Admin (Account 0)
   └─ MetaMask: Account 0 (0x90F8...)
   └─ Dashboard: Admin Dashboard

2. Verify System Health
   └─ Check: Database Online
   └─ Check: Blockchain Online (Block #, Chain ID 1339)
   └─ Check: Storage Online
   └─ Check: Contracts Deployed (4 addresses)

3. Register Test Users (Optional - can use init script)
   └─ See A2, A3
```

### A2: Register Patient
```
1. Navigate: Dashboard → Register Patient (Quick Actions)
2. Fill Form:
   ├─ Wallet Address: 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0 (Account 1)
   ├─ Full Name: Alice Johnson
   ├─ Email: alice.johnson@patient.local
   └─ Patient ID: PAT-001
3. Click "Register"
4. MetaMask: Confirm transaction (Account 0 signs)
5. Wait for blockchain confirmation
6. Success: Patient appears in Users list
7. Audit Log: USER_REGISTERED event recorded
```

### A3: Register Doctor
```
1. Navigate: Dashboard → Register Doctor (Quick Actions)
2. Fill Form:
   ├─ Wallet Address: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (Account 11)
   ├─ Full Name: Dr. Sarah Thompson
   ├─ Email: sarah.thompson@doctor.local
   └─ License Number: MD-001
3. Click "Register"
4. MetaMask: Confirm transaction (Account 0 signs)
5. Wait for blockchain confirmation
6. Success: Doctor appears in Users list
7. Audit Log: USER_REGISTERED event recorded
```

### A4: Manage Users
```
1. Navigate: Dashboard → All Users
2. View: Paginated table with filters (Role, Status)
3. Actions per user:
   ├─ Deactivate: Sets status=SUSPENDED, revokes blockchain roles
   ├─ Reactivate: Sets status=ACTIVE, restores blockchain roles
   └─ View Details: Shows blockchain user info
4. Cannot deactivate self (protected)
```

### A5: Monitor System
```
1. Dashboard Stats:
   ├─ Total Users, Patients, Doctors
   ├─ Total Medical Records
   ├─ Pending Access Requests
   └─ Blockchain Status (Block #, Chain ID)

2. Audit Logs:
   ├─ Filter by: Action, Actor, Date Range
   ├─ View: Database logs + Blockchain logs
   ├─ Export: For compliance reporting

3. System Health:
   ├─ Database: Online/Offline
   ├─ Blockchain: Online/Offline + Block Height
   ├─ Storage: File Count + Total Size
   └─ Contract Addresses: All 4 contracts
```

## Patient Workflows

### P1: Login & Dashboard
```
1. Open application on phone
2. Connect MetaMask (Patient account, e.g., Account 1)
3. Sign authentication message
4. Redirected to Patient Dashboard

Dashboard Shows:
├─ Total Records: X
├─ Pending Requests: Y
├─ Active Permissions: Z
└─ Recent Activity: Last 5 actions
```

### P2: Upload Medical Record
```
1. Navigate: My Records → Upload Record (or Upload tab)
2. Select File:
   ├─ Supported: PDF, JPG, PNG, TIFF, DICOM, TXT
   ├─ Max Size: 50MB
   └─ Drag & drop or click to browse
3. Enter Record Name: "Blood Test Report - January 2024"
4. Select Record Type: LAB_RESULT
5. Click "Upload Record"

Backend Process:
├─ Validate file type/size
├─ Generate SHA-256 hash
├─ Encrypt with AES-256-GCM (unique key)
├─ Store encrypted file locally
├─ Get CID/reference
├─ Call MedicalRecordRegistry.registerRecord()
├─ Save metadata to PostgreSQL
├─ Log RECORD_UPLOADED to AuditLog
└─ Return success with transaction hash

6. Frontend: Shows success toast with tx hash
7. Record appears in "My Records" list
```

### P3: View My Records
```
1. Navigate: My Records tab
2. Table shows:
   ├─ Record Name
   ├─ Type (badge)
   ├─ Upload Date
   ├─ File Size
   ├─ Hash (truncated)
   ├─ Storage CID
   └─ Actions: Download, Verify, View Details
3. Click Download → File downloads, hash verified
4. Click Verify → Calls blockchain verifyFileIntegrity()
```

### P4: Manage Access Requests
```
1. Navigate: Access Requests tab
2. Table shows pending requests:
   ├─ Doctor Name + Wallet
   ├─ Requested Record (or "All Records")
   ├─ Reason + Purpose
   ├─ Requested Date
   ├─ Expiry Date (or "No expiry")
   ├─ Status Badge: PENDING
   └─ Actions: Approve / Deny

3. To Approve:
   ├─ Click "Approve" button
   ├─ MetaMask opens: Confirm transaction
   ├─ Sign with patient wallet
   ├─ Wait for blockchain confirmation
   ├─ Status changes to APPROVED (green badge)
   ├─ Doctor notified
   └─ Audit Log: ACCESS_APPROVED

4. To Deny:
   ├─ Click "Deny" button
   ├─ MetaMask opens: Confirm transaction
   ├─ Sign with patient wallet
   ├─ Status changes to DENIED (red badge)
   ├─ Doctor notified
   └─ Audit Log: ACCESS_DENIED
```

### P5: Manage Granted Access
```
1. Navigate: Granted Access tab
2. Table shows approved requests:
   ├─ Doctor Name
   ├─ Record Name
   ├─ Approved Date
   ├─ Expiry Date (or "No expiry")
   ├─ Status Badge: APPROVED
   └─ Action: Revoke

3. To Revoke:
   ├─ Click "Revoke" button
   ├─ Confirm: "Are you sure?"
   ├─ MetaMask opens: Confirm transaction
   ├─ Status changes to REVOKED
   ├─ Doctor immediately loses access
   ├─ Doctor notified
   └─ Audit Log: ACCESS_REVOKED
```

### P6: View Audit Log
```
1. Navigate: Audit Log tab
2. Table shows patient's actions:
   ├─ Timestamp
   ├─ Action (e.g., RECORD_UPLOADED, ACCESS_APPROVED)
   ├─ Target (Record name, Request ID)
   └─ Status
3. Read-only for patient
```

## Doctor Workflows

### D1: Login & Dashboard
```
1. Open application on phone
2. Connect MetaMask (Doctor account, e.g., Account 11)
3. Sign authentication message
4. Redirected to Doctor Dashboard

Dashboard Shows:
├─ Pending Requests: X
├─ Approved Access: Y
├─ Available Records: Z
└─ Recent Activity
```

### D2: Search Patients
```
1. Navigate: Search Patients tab
2. Enter search query:
   ├─ Patient Name: "Alice"
   ├─ Wallet Address: "0xFFcf..."
   └─ Patient ID: "PAT-001"
3. Click Search or press Enter
4. Results table shows:
   ├─ Patient Name + Email
   ├─ Patient ID
   ├─ Wallet Address (truncated)
   ├─ Record Count
   └─ Action: Request Access
```

### D3: Request Access
```
1. From search results, click "Request Access" on patient row
2. Modal opens with patient info pre-filled
3. Fill Form:
   ├─ Record (Optional): Dropdown of patient's records
      │  └─ Leave empty for "Full Record Access"
   ├─ Access Level:
      │  ├─ Specific Record (default)
      │  ├─ Full Record Access
      │  └─ Record Category
   ├─ Reason: "Need to review lab results for treatment planning"
   ├─ Purpose: "Diabetes management follow-up"
   └─ Expiration: 24 hours (or custom, 0 = no expiry)
4. Click "Request Access"
5. MetaMask opens: Confirm transaction (doctor wallet)
6. Wait for confirmation
7. Request appears in "My Requests" with PENDING status
8. Patient receives notification
9. Audit Log: ACCESS_REQUESTED
```

### D4: View My Requests
```
1. Navigate: My Requests tab
2. Table shows all requests by this doctor:
   ├─ Patient Name
   ├─ Record (or "All Records")
   ├─ Access Level
   ├─ Reason
   ├─ Status Badge (PENDING/APPROVED/DENIED/REVOKED/EXPIRED)
   ├─ Requested Date
   ├─ Decided Date
   └─ Expiry Date
3. Read-only (cannot modify after submission)
```

### D5: Access Authorized Records
```
1. Navigate: Authorized Records tab
2. Table shows only APPROVED, non-expired, non-revoked records:
   ├─ Patient Name
   ├─ Record Name
   ├─ Record Type
   ├─ Approved Date
   ├─ Expiry Date (or "No expiry")
   └─ Actions: Download, View

3. To Download:
   ├─ Click "Download" button
   ├─ Backend verifies: checkAccess() on blockchain
   ├─ If authorized: Retrieves encrypted file
   ├─ Decrypts file (AES-256-GCM)
   ├─ Verifies SHA-256 hash matches
   ├─ Returns file to browser
   ├─ Logs RECORD_ACCESSED to AuditLog
   └─ File downloads automatically

4. If Access Revoked/Expired:
   ├─ Click Download
   ├─ Backend checks blockchain → hasAccess = false
   ├─ Returns 403: "Access denied. No valid consent."
   └─ No file access
```

### D6: View Audit Log
```
1. Navigate: Audit Log tab
2. Shows doctor's actions:
   ├─ ACCESS_REQUESTED
   ├─ RECORD_ACCESSED
   ├─ RECORD_DOWNLOADED
   └─ Timestamps, targets, statuses
```

## Cross-Role Workflows

### Complete Patient-Doctor Cycle
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE ACCESS CYCLE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ADMIN                                                                       │
│  ├── Registers Patient (Account 1)                                          │
│  └── Registers Doctor (Account 11)                                          │
│                                    │                                        │
│                                    ▼                                        │
│  PATIENT (Account 1)                                                         │
│  ├── Login                                                                   │
│  ├── Upload Record: "Blood Report.pdf"                                      │
│  │   ├── Hash: 0xabc123...                                                  │
│  │   ├── Encrypt → AES-256-GCM                                              │
│  │   ├── Store → local_abc123...                                            │
│  │   └── Blockchain: MedicalRecordRegistry.registerRecord()                │
│  │       └── Returns recordId = 1                                           │
│  │                                                                           │
│  DOCTOR (Account 11)                                                        │
│  ├── Login                                                                   │
│  ├── Search "Alice" → Finds Patient                                         │
│  ├── Request Access to Record #1                                            │
│  │   ├── Reason: "Review for treatment"                                     │
│  │   ├── Expires: 24 hours                                                  │
│  │   └── Blockchain: ConsentManager.requestAccess() → requestId = 1       │
│  │                                                                           │
│  PATIENT                                                                     │
│  ├── Sees Pending Request in Access Requests                                │
│  ├── Clicks "Approve"                                                       │
│  │   ├── MetaMask signs                                                     │
│  │   └── Blockchain: ConsentManager.approveAccess(1)                       │
│  │       └── Status = APPROVED, Access Granted                              │
│  │                                                                           │
│  DOCTOR                                                                      │
│  ├── Sees Approved in Authorized Records                                    │
│  ├── Clicks Download                                                        │
│  │   ├── Backend: checkAccess(doctor, patient, recordId)                   │
│  │   │   └── Returns: { hasAccess: true, status: APPROVED }               │
│  │   ├── Retrieves encrypted file                                           │
│  │   ├── Decrypts with stored key                                           │
│  │   ├── Verifies hash = 0xabc123... ✓                                     │
│  │   └── Returns file → Doctor views                                        │
│  │       └── Audit: RECORD_ACCESSED                                         │
│  │                                                                           │
│  PATIENT (Later)                                                            │
│  ├── Clicks "Revoke" on Granted Access                                      │
│  │   ├── MetaMask signs                                                     │
│  │   └── Blockchain: ConsentManager.revokeAccess(1)                        │
│  │       └── Status = REVOKED                                               │
│  │                                                                           │
│  DOCTOR (After Revoke)                                                      │
│  ├── Tries to Download again                                                │
│  │   ├── Backend: checkAccess()                                             │
│  │   │   └── Returns: { hasAccess: false, status: REVOKED }              │
│  │   └── 403 Error: "Access revoked by patient"                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Denial Workflow
```
DOCTOR → Request Access → PATIENT → Deny → DOCTOR sees DENIED → Cannot access
```

### Expiration Workflow
```
DOCTOR → Request (1 min expiry) → PATIENT → Approve → 
WAIT 1+ minutes → 
DOCTOR → Try Access → Blockchain returns EXPIRED → 403 Error
```

## Error Scenarios & Handling

### Network Errors
| Scenario | User Experience | Resolution |
|----------|-----------------|------------|
| Ganache down | "Blockchain offline" banner | Admin restarts Ganache |
| Backend down | "Server unavailable" | Admin restarts backend |
| Wrong MetaMask network | "Switch to Patient Healthcare Blockchain" | Click switch network |
| Transaction rejected | "Transaction rejected by user" | Retry or cancel |
| Transaction failed | "Transaction failed: [reason]" | Check gas, retry |

### Permission Errors
| Scenario | User Experience | Resolution |
|----------|-----------------|------------|
| Doctor no consent | "Access denied. No valid consent." | Request access |
| Consent revoked | "Access revoked by patient" | Contact patient |
| Consent expired | "Access expired" | Request new access |
| Wrong role | Redirect to Unauthorized page | Use correct account |
| Deactivated user | "Account suspended" | Contact admin |

### File Errors
| Scenario | User Experience | Resolution |
|----------|-----------------|------------|
| Invalid file type | "Invalid file type. Allowed: PDF, JPG..." | Use supported format |
| File too large | "File size exceeds 50MB limit" | Compress/split file |
| Hash mismatch | "File integrity verification failed" | Contact admin (corruption) |
| Decryption failed | "Failed to decrypt file" | Contact admin (key issue) |

## Notification Types

| Type | Trigger | Recipient | Channel |
|------|---------|-----------|---------|
| ACCESS_REQUEST | Doctor requests access | Patient | In-app |
| ACCESS_APPROVED | Patient approves | Doctor | In-app |
| ACCESS_DENIED | Patient denies | Doctor | In-app |
| ACCESS_REVOKED | Patient revokes | Doctor | In-app |
| RECORD_UPLOADED | Patient uploads | Patient | In-app |
| RECORD_ACCESSED | Doctor downloads | Audit log | In-app |

## Batch Operations (Admin)

### Bulk User Registration
```
1. Prepare CSV with columns: wallet, name, email, role, identifier
2. Admin Dashboard → Bulk Import (future feature)
3. System validates all rows
4. Registers each via blockchain + database
4. Reports successes/failures
```

### System Maintenance
```
1. Admin → System Status → "Maintenance Mode" (future)
2. Blocks new logins
3. Allows active sessions to complete
4. Admin performs DB/blockchain maintenance
5. Disable Maintenance Mode
```

## Audit & Compliance Workflows

### Generate Compliance Report
```
1. Admin → Audit Logs
2. Filter: Date Range (e.g., Last 30 days)
3. Filter: Actions (e.g., ACCESS_APPROVED, RECORD_ACCESSED)
4. Export: CSV/JSON
5. Report includes:
   - All access grants/denials/revocations
   - Record uploads/accesses
   - User registrations/deactivations
   - Blockchain transaction hashes
   - Timestamps
```

### Patient Data Access Report (for patient)
```
1. Patient → Audit Log
2. Shows all actions on their data
3. Export for personal records
```

## Emergency Procedures

### Emergency Access (Break Glass)
```
Future Feature:
1. Admin → Emergency Access
2. Select Patient + Doctor
3. Reason: "Emergency treatment - patient unconscious"
4. Creates temporary consent (bypasses patient approval)
5. Auto-expires in 4 hours
6. Full audit trail with EMERGENCY_ACCESS flag
7. Patient notified after emergency
```

### System Recovery
```
1. Stop all services
2. Restore PostgreSQL from backup
3. Restart Ganache (same mnemonic = same accounts)
4. Re-deploy contracts (same addresses)
5. Start backend → re-initializes blockchain service
6. Start frontend
7. Verify: All user wallets work, records accessible
```