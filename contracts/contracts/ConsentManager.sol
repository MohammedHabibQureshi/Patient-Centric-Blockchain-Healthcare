// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./UserRegistry.sol";
import "./MedicalRecordRegistry.sol";

/**
 * @title ConsentManager
 * @dev Manages access requests, approvals, denials, revocations, and expiration.
 * This is the core consent contract - blockchain is the source of truth for consent state.
 */
contract ConsentManager is AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant PATIENT_ROLE = keccak256("PATIENT_ROLE");
    bytes32 public constant DOCTOR_ROLE = keccak256("DOCTOR_ROLE");

    Counters.Counter private _requestIdCounter;

    enum ConsentStatus {
        PENDING,
        APPROVED,
        DENIED,
        REVOKED,
        EXPIRED
    }

    enum AccessLevel {
        FULL_RECORD,
        SPECIFIC_RECORD,
        RECORD_CATEGORY
    }

    struct AccessRequest {
        uint256 requestId;
        address patientAddress;
        address doctorAddress;
        uint256 recordId; // 0 means all records / category access
        AccessLevel accessLevel;
        string reason;
        string purpose;
        ConsentStatus status;
        uint256 requestedAt;
        uint256 decidedAt;
        uint256 expiresAt; // 0 means no expiration
        bytes32 patientSignature; // For off-chain signing if needed
        bytes32 doctorSignature;
        string txHashRequested;
        string txHashDecided;
        bool exists;
    }

    mapping(uint256 => AccessRequest) public requests;
    mapping(address => uint256[]) public patientRequests;
    mapping(address => uint256[]) public doctorRequests;
    mapping(uint256 => mapping(address => bool)) public recordAccess; // requestId -> doctorAddress -> hasAccess

    event AccessRequested(
        uint256 indexed requestId,
        address indexed patientAddress,
        address indexed doctorAddress,
        uint256 recordId,
        AccessLevel accessLevel,
        string reason,
        uint256 expiresAt,
        uint256 timestamp
    );

    event AccessApproved(
        uint256 indexed requestId,
        address indexed patientAddress,
        address indexed doctorAddress,
        uint256 recordId,
        uint256 expiresAt,
        uint256 timestamp
    );

    event AccessDenied(
        uint256 indexed requestId,
        address indexed patientAddress,
        address indexed doctorAddress,
        uint256 recordId,
        uint256 timestamp
    );

    event AccessRevoked(
        uint256 indexed requestId,
        address indexed patientAddress,
        address indexed doctorAddress,
        uint256 recordId,
        uint256 timestamp
    );

    event AccessExpired(
        uint256 indexed requestId,
        address indexed patientAddress,
        address indexed doctorAddress,
        uint256 recordId,
        uint256 timestamp
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PATIENT_ROLE, msg.sender);
        _grantRole(DOCTOR_ROLE, msg.sender);
    }

    modifier requestExists(uint256 requestId) {
        require(requests[requestId].exists, "ConsentManager: request does not exist");
        _;
    }

    modifier onlyPatient(address patientAddress) {
        require(msg.sender == patientAddress, "ConsentManager: only patient can perform this action");
        _;
    }

    modifier onlyDoctor(address doctorAddress) {
        require(msg.sender == doctorAddress, "ConsentManager: only doctor can perform this action");
        _;
    }

    modifier onlyRequestPatient(uint256 requestId) {
        require(
            requests[requestId].patientAddress == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "ConsentManager: not the request patient or admin"
        );
        _;
    }

    modifier onlyRequestDoctor(uint256 requestId) {
        require(requests[requestId].doctorAddress == msg.sender, "ConsentManager: not the request doctor");
        _;
    }

    /**
     * @dev Doctor requests access to patient's medical record(s)
     */
    function requestAccess(
        address patientAddress,
        uint256 recordId,
        AccessLevel accessLevel,
        string calldata reason,
        string calldata purpose,
        uint256 expiresAt
    ) external returns (uint256) {
        require(patientAddress != address(0), "ConsentManager: invalid patient address");
        require(msg.sender != patientAddress, "ConsentManager: cannot request access to own records");
        require(bytes(reason).length > 0, "ConsentManager: reason cannot be empty");
        require(bytes(purpose).length > 0, "ConsentManager: purpose cannot be empty");
        require(expiresAt == 0 || expiresAt > block.timestamp, "ConsentManager: expiration must be in future");

        _requestIdCounter.increment();
        uint256 requestId = _requestIdCounter.current();

        requests[requestId] = AccessRequest({
            requestId: requestId,
            patientAddress: patientAddress,
            doctorAddress: msg.sender,
            recordId: recordId,
            accessLevel: accessLevel,
            reason: reason,
            purpose: purpose,
            status: ConsentStatus.PENDING,
            requestedAt: block.timestamp,
            decidedAt: 0,
            expiresAt: expiresAt,
            patientSignature: bytes32(0),
            doctorSignature: bytes32(0),
            txHashRequested: "",
            txHashDecided: "",
            exists: true
        });

        patientRequests[patientAddress].push(requestId);
        doctorRequests[msg.sender].push(requestId);

        emit AccessRequested(
            requestId,
            patientAddress,
            msg.sender,
            recordId,
            accessLevel,
            reason,
            expiresAt,
            block.timestamp
        );

        return requestId;
    }

    /**
     * @dev Patient approves an access request
     */
    function approveAccess(uint256 requestId) external onlyRequestPatient(requestId) requestExists(requestId) {
        AccessRequest storage request = requests[requestId];
        require(request.status == ConsentStatus.PENDING, "ConsentManager: request not pending");
        require(request.expiresAt == 0 || request.expiresAt > block.timestamp, "ConsentManager: request expired");

        request.status = ConsentStatus.APPROVED;
        request.decidedAt = block.timestamp;

        // Grant access based on access level
        if (request.accessLevel == AccessLevel.SPECIFIC_RECORD && request.recordId != 0) {
            recordAccess[requestId][request.doctorAddress] = true;
        } else if (request.accessLevel == AccessLevel.FULL_RECORD || request.accessLevel == AccessLevel.RECORD_CATEGORY) {
            recordAccess[requestId][request.doctorAddress] = true;
        }

        emit AccessApproved(
            requestId,
            request.patientAddress,
            request.doctorAddress,
            request.recordId,
            request.expiresAt,
            block.timestamp
        );
    }

    /**
     * @dev Patient denies an access request
     */
    function denyAccess(uint256 requestId) external onlyRequestPatient(requestId) requestExists(requestId) {
        AccessRequest storage request = requests[requestId];
        require(request.status == ConsentStatus.PENDING, "ConsentManager: request not pending");

        request.status = ConsentStatus.DENIED;
        request.decidedAt = block.timestamp;

        emit AccessDenied(
            requestId,
            request.patientAddress,
            request.doctorAddress,
            request.recordId,
            block.timestamp
        );
    }

    /**
     * @dev Patient revokes previously granted access
     */
    function revokeAccess(uint256 requestId) external onlyRequestPatient(requestId) requestExists(requestId) {
        AccessRequest storage request = requests[requestId];
        require(request.status == ConsentStatus.APPROVED, "ConsentManager: access not approved");

        request.status = ConsentStatus.REVOKED;
        request.decidedAt = block.timestamp;
        recordAccess[requestId][request.doctorAddress] = false;

        emit AccessRevoked(
            requestId,
            request.patientAddress,
            request.doctorAddress,
            request.recordId,
            block.timestamp
        );
    }

    /**
     * @dev Check if doctor has valid access to a specific record
     * This is the core function - backend MUST call this before releasing records
     */
    function checkAccess(
        address doctorAddress,
        address patientAddress,
        uint256 recordId
    ) external view returns (bool hasAccess, ConsentStatus status, uint256 expiresAt) {
        // Check all approved requests for this doctor-patient pair
        uint256[] storage docRequests = doctorRequests[doctorAddress];
        
        for (uint256 i = 0; i < docRequests.length; i++) {
            AccessRequest storage request = requests[docRequests[i]];
            
            if (request.patientAddress != patientAddress) continue;
            if (request.status != ConsentStatus.APPROVED) continue;
            
            // Check expiration
            if (request.expiresAt != 0 && request.expiresAt <= block.timestamp) {
                // Status will be updated to EXPIRED by caller if needed
                return (false, ConsentStatus.EXPIRED, request.expiresAt);
            }
            
            // Check access level
            if (request.accessLevel == AccessLevel.FULL_RECORD) {
                if (recordAccess[docRequests[i]][doctorAddress]) {
                    return (true, ConsentStatus.APPROVED, request.expiresAt);
                }
            } else if (request.accessLevel == AccessLevel.SPECIFIC_RECORD) {
                if (request.recordId == recordId && recordAccess[docRequests[i]][doctorAddress]) {
                    return (true, ConsentStatus.APPROVED, request.expiresAt);
                }
            } else if (request.accessLevel == AccessLevel.RECORD_CATEGORY) {
                // For category access, we'd need additional logic
                // For now, treat as full record access for simplicity
                if (recordAccess[docRequests[i]][doctorAddress]) {
                    return (true, ConsentStatus.APPROVED, request.expiresAt);
                }
            }
        }
        
        return (false, ConsentStatus.DENIED, 0);
    }

    /**
     * @dev Get request details
     */
    function getRequest(uint256 requestId) external view requestExists(requestId) returns (AccessRequest memory) {
        return requests[requestId];
    }

    /**
     * @dev Get all request IDs for a patient
     */
    function getPatientRequests(address patientAddress) external view returns (uint256[] memory) {
        return patientRequests[patientAddress];
    }

    /**
     * @dev Get all request IDs for a doctor
     */
    function getDoctorRequests(address doctorAddress) external view returns (uint256[] memory) {
        return doctorRequests[doctorAddress];
    }

    /**
     * @dev Get pending requests for a patient
     */
    function getPendingRequestsForPatient(address patientAddress) external view returns (uint256[] memory) {
        uint256[] storage allReqs = patientRequests[patientAddress];
        uint256[] memory pending = new uint256[](allReqs.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allReqs.length; i++) {
            if (requests[allReqs[i]].status == ConsentStatus.PENDING) {
                pending[count] = allReqs[i];
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = pending[i];
        }
        return result;
    }

    /**
     * @dev Get approved requests for a doctor
     */
    function getApprovedRequestsForDoctor(address doctorAddress) external view returns (uint256[] memory) {
        uint256[] storage allReqs = doctorRequests[doctorAddress];
        uint256[] memory approved = new uint256[](allReqs.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allReqs.length; i++) {
            if (requests[allReqs[i]].status == ConsentStatus.APPROVED) {
                // Check expiration
                if (requests[allReqs[i]].expiresAt == 0 || requests[allReqs[i]].expiresAt > block.timestamp) {
                    approved[count] = allReqs[i];
                    count++;
                }
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = approved[i];
        }
        return result;
    }

    /**
     * @dev Mark expired requests (can be called by anyone)
     */
    function updateExpiredRequests() external {
        uint256[] storage allReqs = doctorRequests[msg.sender]; // Just to iterate, we need a different approach
        // Since we can't iterate all requests easily, this would be called off-chain
        // This is a placeholder for a more sophisticated implementation
    }

    /**
     * @dev Get request count
     */
    function getTotalRequests() external view returns (uint256) {
        return _requestIdCounter.current();
    }
}