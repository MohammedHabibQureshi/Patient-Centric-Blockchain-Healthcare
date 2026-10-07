# Testing Guide

This document describes the testing strategy and test cases for the Patient-Centric Blockchain Healthcare Data Sharing System.

## Test Categories

### 1. Unit Tests
- Smart contract functions
- Backend service logic
- Utility functions
- Cryptographic operations

### 2. Integration Tests
- API endpoints
- Database operations
- Blockchain interactions
- Storage encryption/decryption

### 3. End-to-End Tests
- Complete user workflows
- Multi-role scenarios
- Cross-component integration

### 4. Security Tests
- Authentication/authorization
- Input validation
- Access control
- Encryption verification

## Running Tests

### Smart Contract Tests
```bash
cd contracts
npm test
```

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### All Tests
```bash
npm test
```

## Smart Contract Test Cases

### UserRegistry
| Test Case | Description | Expected |
|-----------|-------------|----------|
| Admin registered by default | Deployer is auto-registered as admin | ✓ Admin exists with correct role |
| Register patient | Admin registers new patient | ✓ Patient stored with PATIENT role |
| Register doctor | Admin registers new doctor | ✓ Doctor stored with DOCTOR role |
| Duplicate registration | Register same wallet twice | ✗ Reverts with error |
| Unauthorized registration | Non-admin tries to register | ✗ Reverts with "not a registrar" |
| Deactivate user | Admin deactivates user | ✓ Status changes to SUSPENDED |
| Reactivate user | Admin reactivates user | ✓ Status changes to ACTIVE |
| Get patients list | Query active patients | ✓ Returns only active patients |
| Get doctors list | Query active doctors | ✓ Returns only active doctors |

### MedicalRecordRegistry
| Test Case | Description | Expected |
|-----------|-------------|----------|
| Register record | Registrar registers record metadata | ✓ Record stored with hash, CID |
| Unauthorized registration | Non-registrar tries to register | ✗ Reverts |
| Get patient records | Query records for patient | ✓ Returns record IDs |
| Verify integrity | Check hash matches | ✓ Returns true/false |
| Deactivate record | Patient deactivates own record | ✓ isActive = false |

### ConsentManager
| Test Case | Description | Expected |
|-----------|-------------|----------|
| Request access | Doctor requests access | ✓ Request created with PENDING status |
| Approve access | Patient approves request | ✓ Status APPROVED, access granted |
| Deny access | Patient denies request | ✓ Status DENIED |
| Revoke access | Patient revokes approved access | ✓ Status REVOKED, access removed |
| Check access | Verify doctor has access | ✓ Returns (true, APPROVED, expiresAt) |
| Check denied access | Verify denied doctor has no access | ✓ Returns (false, DENIED, 0) |
| Check expired access | Verify expired consent returns EXPIRED | ✓ Returns (false, EXPIRED, expiresAt) |
| Check revoked access | Verify revoked consent returns REVOKED | ✓ Returns (false, REVOKED, 0) |
| Expiration | Request with short expiry | ✓ Becomes EXPIRED after time |

### AuditLog
| Test Case | Description | Expected |
|-----------|-------------|----------|
| Log entry | System logs audit entry | ✓ Entry stored with all fields |
| Unauthorized log | Non-system tries to log | ✗ Reverts |
| Query by actor | Get logs for specific wallet | ✓ Returns matching logs |
| Query by action | Get logs for specific action | ✓ Returns matching logs |
| Recent logs | Get last N logs | ✓ Returns recent entries |

## Backend API Test Cases

### Authentication
| Test | Endpoint | Expected |
|------|----------|----------|
| Get nonce | POST /api/auth/nonce | Returns nonce + message |
| Verify valid signature | POST /api/auth/verify | Returns user + tokens |
| Verify invalid signature | POST /api/auth/verify | 401 error |
| Unregistered wallet | POST /api/auth/verify | 403 error |
| Deactivated wallet | POST /api/auth/verify | 403 error |
| Refresh token | POST /api/auth/refresh | Returns new tokens |
| Get current user | GET /api/auth/me | Returns user data |

### User Management (Admin)
| Test | Endpoint | Expected |
|------|----------|----------|
| Register patient | POST /api/users/patients | 201, user created |
| Register doctor | POST /api/users/doctors | 201, user created |
| Duplicate wallet | POST /api/users/patients | 409 error |
| Invalid wallet format | POST /api/users/patients | 400 error |
| Deactivate user | POST /api/users/deactivate | 200, status SUSPENDED |
| Reactivate user | POST /api/users/reactivate | 200, status ACTIVE |
| Self-deactivate | POST /api/users/deactivate | 400 error |
| List users | GET /api/users | Paginated user list |
| Filter by role | GET /api/users?role=PATIENT | Filtered results |
| Get patients | GET /api/users/patients | Active patients only |
| Get doctors | GET /api/users/doctors | Active doctors only |

### Medical Records (Patient)
| Test | Endpoint | Expected |
|------|----------|----------|
| Upload valid file | POST /api/records | 201, record created |
| Upload invalid type | POST /api/records | 400 error |
| Upload too large | POST /api/records | 400 error |
| No file | POST /api/records | 400 error |
| Get my records | GET /api/records | Patient's records only |
| Download own record | GET /api/records/:id/download | File blob returned |
| Download other's record | GET /api/records/:id/download | 403 error |
| Verify integrity | GET /api/records/:id/verify | Hash match result |

### Access Requests
| Test | Endpoint | Expected |
|------|----------|----------|
| Doctor requests access | POST /api/access/request | 201, request created |
| Patient requests access | POST /api/access/request | 403 error |
| Get my requests (patient) | GET /api/access/requests | Patient's incoming requests |
| Get my requests (doctor) | GET /api/access/requests | Doctor's outgoing requests |
| Approve request | POST /api/access/requests/:id/approve | 200, status APPROVED |
| Deny request | POST /api/access/requests/:id/deny | 200, status DENIED |
| Revoke access | POST /api/access/requests/:id/revoke | 200, status REVOKED |
| Check access | GET /api/access/check | Returns access status |
| Get authorized records | GET /api/access/authorized | Doctor's approved records |

### Audit Logs (Admin)
| Test | Endpoint | Expected |
|------|----------|----------|
| Get audit logs | GET /api/audit/logs | Paginated logs |
| Filter by action | GET /api/audit/logs?action=USER_REGISTERED | Filtered |
| Filter by actor | GET /api/audit/logs?actorWallet=0x... | Filtered |
| Get system health | GET /api/audit/health | Service statuses |

## End-to-End Workflow Tests

### Complete Patient-Doctor Workflow
```
1. Admin Login
   └─ Connect Account 0 → Admin Dashboard

2. Register Patient (Account 1)
   └─ Admin → Register Patient → "Alice Johnson" → PAT-001

3. Register Doctor (Account 11)
   └─ Admin → Register Doctor → "Dr. Smith" → MD-001

4. Patient Login (Account 1)
   └─ Connect Account 1 → Patient Dashboard

5. Upload Record
   └─ Patient → Upload "blood_report.pdf" → LAB_RESULT
   └─ Verify: Record appears, hash stored, tx confirmed

6. Doctor Login (Account 11)
   └─ Connect Account 11 → Doctor Dashboard

7. Search Patient
   └─ Doctor → Search "Alice" → Finds patient

7. Request Access
   └─ Doctor → Request Access to blood report
   └─ Reason: "Review lab results for treatment"
   └─ Verify: Request appears in patient's dashboard

8. Patient Approves
   └─ Patient → Access Requests → Approve
   └─ Sign MetaMask transaction
   └─ Verify: Status = APPROVED

9. Doctor Accesses Record
   └─ Doctor → Authorized Records → Download
   └─ Verify: File downloads, hash verified

10. Patient Revokes
    └─ Patient → Granted Access → Revoke
    └─ Verify: Doctor can no longer access
```

### Denial Workflow
```
1. Doctor requests access
2. Patient clicks "Deny"
3. Doctor sees "Access denied" in requests
4. Doctor cannot download record
```

### Expiration Workflow
```
1. Doctor requests access with 1-minute expiry
2. Patient approves
3. Wait 1+ minutes
4. Doctor tries to access → EXPIRED
5. Status shows EXPIRED in both dashboards
```

### Unauthorized Access Tests
| Scenario | Expected |
|----------|----------|
| Patient accesses admin endpoint | 403 |
| Doctor registers patient | 403 |
| Patient registers doctor | 403 |
| Unregistered wallet accesses dashboard | Redirect to login |
| Deactivated user accesses records | 403 |
| Doctor accesses without consent | 403 |
| Doctor accesses after revocation | 403 |
| Doctor accesses after expiration | 403 |

## Blockchain Tests

### Ganache Determinism
```bash
# Test 1: Start Ganache, record addresses
npm run blockchain
# Save account addresses

# Test 2: Stop Ganache (Ctrl+C)
# Test 3: Restart Ganache
npm run blockchain
# Compare addresses - MUST match exactly
```

### Contract Deployment
- All 4 contracts deploy successfully
- Addresses saved to `contracts/contracts.json`
- Constructor arguments correct
- Roles granted correctly

### Transaction Handling
- Successful transactions return receipt
- Failed transactions return error
- Events emitted correctly
- Gas usage reasonable

## Security Tests

### Authentication
- [ ] Nonce cannot be reused
- [ ] Signature must match wallet address
- [ ] JWT expires correctly
- [ ] Refresh token rotates
- [ ] Invalid tokens rejected

### Authorization
- [ ] Role enforced on backend
- [ ] Role enforced on blockchain
- [ ] Frontend cannot bypass checks
- [ ] Admin-only endpoints protected

### File Security
- [ ] Files encrypted before storage
- [ ] SHA-256 hash stored on-chain
- [ ] Hash verified on download
- [ ] Decryption only after authorization
- [ ] Master key not in frontend

### Input Validation
- [ ] Wallet address format validated
- [ ] File type restricted
- [ ] File size limited
- [ ] SQL injection prevented
- [ ] XSS prevented

## Load/Stress Tests

| Test | Target |
|------|--------|
| Concurrent users | 50+ |
| File uploads | 100+ files |
| Access requests | 200+ requests |
| Blockchain transactions | 500+ tx/min |
| Database queries | 1000+ qps |

## Manual Testing Checklist

### Pre-Deployment
- [ ] Ganache starts with 20 accounts
- [ ] Accounts deterministic across restarts
- [ ] Contracts deploy without errors
- [ ] Database initializes without errors
- [ ] Backend health check passes
- [ ] Frontend builds without errors
- [ ] All 4 terminals can run simultaneously

### LAN Access
- [ ] Admin PC: `http://localhost:5173` works
- [ ] LAN PC: `http://SERVER_IP:5173` works
- [ ] Phone: `http://SERVER_IP:5173` works
- [ ] MetaMask connects to `http://SERVER_IP:7545`
- [ ] Chain ID shows 1338 in MetaMask

### Role-Based Access
- [ ] Account 0 → Admin Dashboard
- [ ] Account 1 → Patient Dashboard
- [ ] Account 11 → Doctor Dashboard
- [ ] Wrong role → Unauthorized page

### Core Features
- [ ] Patient uploads PDF → success
- [ ] Patient uploads JPG → success
- [ ] Patient uploads PNG → success
- [ ] Patient uploads .exe → rejected
- [ ] Doctor searches patient → found
- [ ] Doctor requests access → pending
- [ ] Patient approves → approved
- [ ] Doctor downloads → file received
- [ ] Patient revokes → access denied
- [ ] Patient denies → access denied
- [ ] Expiry works → expired status
- [ ] Audit logs recorded → visible

### Error Handling
- [ ] Ganache down → backend shows offline
- [ ] Database down → backend shows offline
- [ ] Wrong network → switch prompt
- [ ] Rejected tx → error message
- [ ] Invalid file → error message
- [ ] Expired token → re-auth prompt

## Automated Test Scripts

### CI/CD Pipeline Tests
```yaml
# Example GitHub Actions workflow
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - name: Setup Node
      uses: actions/setup-node@v3
      with: { node-version: '18' }
    - name: Install
      run: npm run install:all
    - name: Start Ganache
      run: npx ganache --deterministic --accounts 20 &
    - name: Deploy Contracts
      run: cd contracts && npm run deploy
    - name: Init DB
      run: cd backend && npm run db:init
    - name: Test Contracts
      run: cd contracts && npm test
    - name: Test Backend
      run: cd backend && npm test
    - name: Test Frontend
      run: cd frontend && npm test
```

## Test Data

### Test Files
Create test files in `backend/test-files/`:
- `blood_report.pdf` (sample PDF)
- `xray.jpg` (sample image)
- `prescription.png` (sample image)
- `large_file.pdf` (>50MB for size limit test)

### Test Accounts
Use deterministic Ganache accounts:
```
Admin:      Account 0 (0x90F8...)
Patient 1:  Account 1 (0xFFcf...)
Patient 2:  Account 2 (0x22d4...)
Doctor 1:   Account 11 (0x3C44...)
Doctor 2:   Account 12 (0x6Ec5...)
```

## Reporting

### Test Report Template
```
Test Run: [Date]
Environment: [Local/CI]
Node Version: [version]
Ganache Version: [version]

Results:
- Unit Tests: X passed, Y failed
- Integration Tests: X passed, Y failed
- E2E Tests: X passed, Y failed
- Security Tests: X passed, Y failed

Failures:
1. [Test name] - [Error details]
2. ...

Coverage:
- Contracts: XX%
- Backend: XX%
- Frontend: XX%
```

## Continuous Testing

Run on every:
- Pull request
- Merge to main
- Release tag
- Dependency update

Monitor:
- Test execution time
- Flaky test detection
- Coverage trends