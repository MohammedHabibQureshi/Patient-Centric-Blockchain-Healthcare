// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title UserRegistry
 * @dev Manages user registration, roles, and status on the blockchain.
 * Only ADMIN can register PATIENT and DOCTOR roles.
 * Uses OpenZeppelin AccessControl for role-based permissions.
 */
contract UserRegistry is AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PATIENT_ROLE = keccak256("PATIENT_ROLE");
    bytes32 public constant DOCTOR_ROLE = keccak256("DOCTOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    Counters.Counter private _userIdCounter;

    enum UserStatus {
        INACTIVE,
        ACTIVE,
        SUSPENDED
    }

    enum UserRole {
        NONE,
        ADMIN,
        PATIENT,
        DOCTOR
    }

    struct User {
        uint256 userId;
        address walletAddress;
        string name;
        string email;
        string identifier; // Patient ID or Doctor License Number
        UserRole role;
        UserStatus status;
        uint256 registeredAt;
        address registeredBy;
        bool exists;
    }

    mapping(address => User) public users;
    mapping(uint256 => address) public userIdToAddress;
    address[] public allUsers;

    event UserRegistered(
        uint256 indexed userId,
        address indexed walletAddress,
        string name,
        UserRole role,
        address indexed registeredBy,
        uint256 timestamp
    );

    event UserStatusChanged(
        uint256 indexed userId,
        address indexed walletAddress,
        UserStatus oldStatus,
        UserStatus newStatus,
        address indexed changedBy,
        uint256 timestamp
    );

    event RoleAssigned(
        uint256 indexed userId,
        address indexed walletAddress,
        UserRole role,
        address indexed assignedBy,
        uint256 timestamp
    );

    constructor() AccessControl() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);

        // Register the deployer as the first ADMIN
        _userIdCounter.increment();
        uint256 adminId = _userIdCounter.current();
        users[msg.sender] = User({
            userId: adminId,
            walletAddress: msg.sender,
            name: "System Administrator",
            email: "admin@healthcare.local",
            identifier: "ADMIN-001",
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            registeredAt: block.timestamp,
            registeredBy: msg.sender,
            exists: true
        });
        userIdToAddress[adminId] = msg.sender;
        allUsers.push(msg.sender);

        emit UserRegistered(adminId, msg.sender, "System Administrator", UserRole.ADMIN, msg.sender, block.timestamp);
    }

    modifier onlyRegistrar() {
        require(hasRole(REGISTRAR_ROLE, msg.sender), "UserRegistry: caller is not a registrar");
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "UserRegistry: caller is not an admin");
        _;
    }

    modifier userExists(address wallet) {
        require(users[wallet].exists, "UserRegistry: user does not exist");
        _;
    }

    modifier userActive(address wallet) {
        require(users[wallet].status == UserStatus.ACTIVE, "UserRegistry: user is not active");
        _;
    }

    /**
     * @dev Register a new patient (only ADMIN/REGISTRAR)
     */
    function registerPatient(
        address walletAddress,
        string calldata name,
        string calldata email,
        string calldata patientId
    ) external onlyRegistrar returns (uint256) {
        require(walletAddress != address(0), "UserRegistry: invalid wallet address");
        require(!users[walletAddress].exists, "UserRegistry: wallet already registered");
        require(bytes(name).length > 0, "UserRegistry: name cannot be empty");
        require(bytes(email).length > 0, "UserRegistry: email cannot be empty");
        require(bytes(patientId).length > 0, "UserRegistry: patient ID cannot be empty");

        _userIdCounter.increment();
        uint256 userId = _userIdCounter.current();

        users[walletAddress] = User({
            userId: userId,
            walletAddress: walletAddress,
            name: name,
            email: email,
            identifier: patientId,
            role: UserRole.PATIENT,
            status: UserStatus.ACTIVE,
            registeredAt: block.timestamp,
            registeredBy: msg.sender,
            exists: true
        });

        userIdToAddress[userId] = walletAddress;
        allUsers.push(walletAddress);
        _grantRole(PATIENT_ROLE, walletAddress);

        emit UserRegistered(userId, walletAddress, name, UserRole.PATIENT, msg.sender, block.timestamp);
        emit RoleAssigned(userId, walletAddress, UserRole.PATIENT, msg.sender, block.timestamp);

        return userId;
    }

    /**
     * @dev Register a new doctor (only ADMIN/REGISTRAR)
     */
    function registerDoctor(
        address walletAddress,
        string calldata name,
        string calldata email,
        string calldata licenseNumber
    ) external onlyRegistrar returns (uint256) {
        require(walletAddress != address(0), "UserRegistry: invalid wallet address");
        require(!users[walletAddress].exists, "UserRegistry: wallet already registered");
        require(bytes(name).length > 0, "UserRegistry: name cannot be empty");
        require(bytes(email).length > 0, "UserRegistry: email cannot be empty");
        require(bytes(licenseNumber).length > 0, "UserRegistry: license number cannot be empty");

        _userIdCounter.increment();
        uint256 userId = _userIdCounter.current();

        users[walletAddress] = User({
            userId: userId,
            walletAddress: walletAddress,
            name: name,
            email: email,
            identifier: licenseNumber,
            role: UserRole.DOCTOR,
            status: UserStatus.ACTIVE,
            registeredAt: block.timestamp,
            registeredBy: msg.sender,
            exists: true
        });

        userIdToAddress[userId] = walletAddress;
        allUsers.push(walletAddress);
        _grantRole(DOCTOR_ROLE, walletAddress);

        emit UserRegistered(userId, walletAddress, name, UserRole.DOCTOR, msg.sender, block.timestamp);
        emit RoleAssigned(userId, walletAddress, UserRole.DOCTOR, msg.sender, block.timestamp);

        return userId;
    }

    /**
     * @dev Deactivate a user (only ADMIN/REGISTRAR)
     */
    function deactivateUser(address walletAddress) external onlyRegistrar {
        require(users[walletAddress].exists, "UserRegistry: user does not exist");
        require(users[walletAddress].status == UserStatus.ACTIVE, "UserRegistry: user already inactive");

        UserStatus oldStatus = users[walletAddress].status;
        users[walletAddress].status = UserStatus.SUSPENDED;

        _revokeRole(PATIENT_ROLE, walletAddress);
        _revokeRole(DOCTOR_ROLE, walletAddress);

        emit UserStatusChanged(
            users[walletAddress].userId,
            walletAddress,
            oldStatus,
            UserStatus.SUSPENDED,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Reactivate a user (only ADMIN/REGISTRAR)
     */
    function reactivateUser(address walletAddress) external onlyRegistrar {
        require(users[walletAddress].exists, "UserRegistry: user does not exist");
        require(users[walletAddress].status == UserStatus.SUSPENDED, "UserRegistry: user not suspended");

        UserStatus oldStatus = users[walletAddress].status;
        users[walletAddress].status = UserStatus.ACTIVE;

        if (users[walletAddress].role == UserRole.PATIENT) {
            _grantRole(PATIENT_ROLE, walletAddress);
        } else if (users[walletAddress].role == UserRole.DOCTOR) {
            _grantRole(DOCTOR_ROLE, walletAddress);
        }

        emit UserStatusChanged(
            users[walletAddress].userId,
            walletAddress,
            oldStatus,
            UserStatus.ACTIVE,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Get user information by wallet address
     */
    function getUser(address walletAddress) external view returns (User memory) {
        return users[walletAddress];
    }

    /**
     * @dev Get user information by user ID
     */
    function getUserById(uint256 userId) external view returns (User memory) {
        address wallet = userIdToAddress[userId];
        return users[wallet];
    }

    /**
     * @dev Check if a wallet is registered
     */
    function isRegistered(address walletAddress) external view returns (bool) {
        return users[walletAddress].exists;
    }

    /**
     * @dev Check if a wallet has a specific role
     */
    function hasUserRole(address walletAddress, UserRole role) external view returns (bool) {
        if (!users[walletAddress].exists) return false;
        return users[walletAddress].role == role;
    }

    /**
     * @dev Get user role
     */
    function getUserRole(address walletAddress) external view returns (UserRole) {
        if (!users[walletAddress].exists) return UserRole.NONE;
        return users[walletAddress].role;
    }

    /**
     * @dev Get user status
     */
    function getUserStatus(address walletAddress) external view returns (UserStatus) {
        if (!users[walletAddress].exists) return UserStatus.INACTIVE;
        return users[walletAddress].status;
    }

    /**
     * @dev Get all registered users (for admin dashboard)
     */
    function getAllUsers() external view returns (address[] memory) {
        return allUsers;
    }

    /**
     * @dev Get total user count
     */
    function getTotalUsers() external view returns (uint256) {
        return allUsers.length;
    }

    /**
     * @dev Get patients only
     */
    function getPatients() external view returns (address[] memory) {
        address[] memory patients = new address[](allUsers.length);
        uint256 count = 0;
        for (uint256 i = 0; i < allUsers.length; i++) {
            if (users[allUsers[i]].role == UserRole.PATIENT && users[allUsers[i]].status == UserStatus.ACTIVE) {
                patients[count] = allUsers[i];
                count++;
            }
        }
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = patients[i];
        }
        return result;
    }

    /**
     * @dev Get doctors only
     */
    function getDoctors() external view returns (address[] memory) {
        address[] memory doctors = new address[](allUsers.length);
        uint256 count = 0;
        for (uint256 i = 0; i < allUsers.length; i++) {
            if (users[allUsers[i]].role == UserRole.DOCTOR && users[allUsers[i]].status == UserStatus.ACTIVE) {
                doctors[count] = allUsers[i];
                count++;
            }
        }
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = doctors[i];
        }
        return result;
    }

    /**
     * @dev Update user profile (name, email) - only by user themselves or admin
     */
    function updateProfile(
        string calldata name,
        string calldata email
    ) external userExists(msg.sender) userActive(msg.sender) {
        require(bytes(name).length > 0, "UserRegistry: name cannot be empty");
        require(bytes(email).length > 0, "UserRegistry: email cannot be empty");

        users[msg.sender].name = name;
        users[msg.sender].email = email;
    }
}