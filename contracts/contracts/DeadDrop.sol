// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev QoreChain precompile: post-quantum (ML-DSA-87) key registration status of an account.
interface IPqcKeyStatus {
    function pqcKeyStatus(address account) external view returns (bool registered, uint8 algorithmId, bytes memory pubkey);
}

/// @title DeadDrop
/// @notice Anchors post-quantum encrypted whistleblower submissions on QoreChain.
///         The evidence is encrypted in the source's browser with QoreSeal (ML-KEM-1024 + X25519, AES-256-GCM) to the
///         recipients' on-chain KEM keys. This contract never sees plaintext: it records the envelope's SHA3-256 hash,
///         size, recipients and inclusion block, and (for small envelopes) emits the ciphertext itself.
/// @dev Submissions arrive through a relayer so the source's own address never appears on chain. The relayer must
///      hold a registered ML-DSA-87 key, checked on every call via the pqcKeyStatus precompile.
contract DeadDrop {
    struct Submission {
        bytes32 envelopeSha3; // SHA3-256 of the QoreSeal envelope bytes
        bytes32 recipientsHash; // keccak256(abi.encode(recipients))
        uint32 size; // envelope size in bytes
        uint64 blockNumber;
        uint64 timestamp;
        bool inline_; // true if the full envelope was emitted in the Submitted event
    }

    /// @notice Largest envelope emitted inline; bigger envelopes are stored off chain under `uri`.
    uint256 public constant MAX_INLINE = 48 * 1024;
    uint256 public constant MAX_RECIPIENTS = 16;

    address public immutable PQC_KEY_STATUS;
    address public owner;
    address public relayer;

    mapping(bytes32 => Submission) public submissions;
    mapping(bytes32 => mapping(address => bool)) public acknowledged;
    uint256 public submissionCount;

    event Submitted(
        bytes32 indexed id,
        address[] recipients,
        bytes32 envelopeSha3,
        uint32 size,
        string uri,
        bytes envelope
    );
    event Acknowledged(bytes32 indexed id, address indexed recipient);
    event RelayerChanged(address indexed relayer);

    error NotOwner();
    error NotRelayer();
    error NoPqcKey(address account);
    error AlreadySubmitted(bytes32 id);
    error UnknownSubmission(bytes32 id);
    error BadRecipients();
    error BadEnvelope();
    error NotARecipient();

    constructor(address relayer_, address pqcKeyStatus_) {
        PQC_KEY_STATUS = pqcKeyStatus_;
        if (!isPqcRegistered(relayer_)) revert NoPqcKey(relayer_);
        owner = msg.sender;
        relayer = relayer_;
        emit RelayerChanged(relayer_);
    }

    // ---------------- Relayer ----------------

    /// @notice Anchor a submission. `envelope` is the full ciphertext (inline) or empty with a `uri` to it.
    /// @param id           Random 32-byte submission id chosen by the source's browser.
    /// @param recipients   0x addresses of the accounts the envelope is sealed to.
    /// @param envelopeSha3 SHA3-256 of the envelope bytes (checked by recipients before opening).
    function submit(
        bytes32 id,
        address[] calldata recipients,
        bytes32 envelopeSha3,
        uint32 size,
        string calldata uri,
        bytes calldata envelope
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        if (!isPqcRegistered(msg.sender)) revert NoPqcKey(msg.sender);
        if (submissions[id].blockNumber != 0) revert AlreadySubmitted(id);
        if (recipients.length == 0 || recipients.length > MAX_RECIPIENTS) revert BadRecipients();
        if (envelopeSha3 == bytes32(0) || size == 0) revert BadEnvelope();
        bool isInline = envelope.length > 0;
        if (isInline && (envelope.length != size || envelope.length > MAX_INLINE)) revert BadEnvelope();
        if (!isInline && bytes(uri).length == 0) revert BadEnvelope();

        submissions[id] = Submission({
            envelopeSha3: envelopeSha3,
            recipientsHash: keccak256(abi.encode(recipients)),
            size: size,
            blockNumber: uint64(block.number),
            timestamp: uint64(block.timestamp),
            inline_: isInline
        });
        submissionCount++;
        emit Submitted(id, recipients, envelopeSha3, size, uri, envelope);
    }

    // ---------------- Recipients ----------------

    /// @notice A recipient confirms on chain that they received submission `id` (reveals nothing about its content).
    function acknowledge(bytes32 id, address[] calldata recipients) external {
        Submission storage s = submissions[id];
        if (s.blockNumber == 0) revert UnknownSubmission(id);
        if (keccak256(abi.encode(recipients)) != s.recipientsHash) revert BadRecipients();
        bool found;
        for (uint256 i = 0; i < recipients.length; i++) if (recipients[i] == msg.sender) found = true;
        if (!found) revert NotARecipient();
        acknowledged[id][msg.sender] = true;
        emit Acknowledged(id, msg.sender);
    }

    // ---------------- Owner ----------------

    function setRelayer(address relayer_) external {
        if (msg.sender != owner) revert NotOwner();
        if (!isPqcRegistered(relayer_)) revert NoPqcKey(relayer_);
        relayer = relayer_;
        emit RelayerChanged(relayer_);
    }

    // ---------------- Views ----------------

    /// @notice True if `account` has a registered post-quantum key (QoreChain pqcKeyStatus precompile). Fails closed.
    function isPqcRegistered(address account) public view returns (bool) {
        (bool ok, bytes memory ret) =
            PQC_KEY_STATUS.staticcall(abi.encodeCall(IPqcKeyStatus.pqcKeyStatus, (account)));
        if (!ok || ret.length < 96) return false;
        (bool registered,,) = abi.decode(ret, (bool, uint8, bytes));
        return registered;
    }

    /// @notice Check a downloaded envelope against the anchored hash (the Proof of Silence check).
    function matches(bytes32 id, bytes32 envelopeSha3) external view returns (bool) {
        Submission storage s = submissions[id];
        return s.blockNumber != 0 && s.envelopeSha3 == envelopeSha3;
    }
}
