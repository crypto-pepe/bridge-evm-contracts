// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import ".//Initializable.sol";

contract Multisig is Initializable {
    struct Transaction {
        address dst;
        uint256 value;
        bytes data;
        bool isExecuted;
        uint256 blockNumber;
    }

    uint128 public quorum;
    uint128 public ttl;
    uint256 public txsCount;
    mapping(uint256 => Transaction) public txs;
    mapping(uint256 => mapping(address => bool)) public confirms;
    mapping(address => bool) public isOwner;
    address[] public owners;

    event Submission(uint256 indexed txId);
    event Confirmation(address indexed sender, uint256 indexed txId);
    event Revocation(address indexed sender, uint256 indexed txId);
    event Execution(uint256 indexed txId, address caller);
    event QuorumChange(uint128 quorum);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);

    modifier onlySelf() {
        require(msg.sender == address(this), "only self");
        _;
    }

    modifier onlyOwner(address owner_) {
        require(isOwner[owner_], "only owner");
        _;
    }

    modifier whenNotConfirmed(uint256 txId_, address owner_) {
        require(!confirms[txId_][owner_], "tx is confirmed");
        _;
    }

    modifier whenNotExecuted(uint256 txId_) {
        require(!txs[txId_].isExecuted, "tx is executed");
        _;
    }

    modifier quorumIsValid(uint256 ownersCount_, uint256 quorum_) {
        require(
            quorum_ <= ownersCount_ && quorum_ != 0 && ownersCount_ != 0,
            "invalid quorum"
        );
        _;
    }

    function init(
        address[] memory owners_,
        uint128 quorum_,
        uint128 ttl_
    ) external quorumIsValid(owners_.length, quorum_) whenNotInitialized {
        for (uint256 i = 0; i < owners_.length; i++) {
            address owner = owners_[i];
            require(owner != address(0), "zero address");
            require(!isOwner[owner], "owner is duplicated");
            isOwner[owner] = true;
        }

        owners = owners_;
        quorum = quorum_;
        ttl = ttl_;
        isInited = true;
    }

    receive() external payable {}

    function addOwner(
        address owner_
    ) external onlySelf quorumIsValid(owners.length + 1, quorum) {
        require(owner_ != address(0), "zero address");
        require(!isOwner[owner_], "only not owner");
        isOwner[owner_] = true;
        owners.push(owner_);
        emit OwnerAddition(owner_);
    }

    function removeOwner(address owner_) external onlySelf onlyOwner(owner_) {
        isOwner[owner_] = false;
        for (uint256 i = 0; i < owners.length - 1; i++) {
            if (owners[i] == owner_) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        }
        owners.pop();
        if (quorum > owners.length) {
            setQuorum(uint128(owners.length));
        }
        emit OwnerRemoval(owner_);
    }

    function setQuorum(
        uint128 quorum_
    ) public onlySelf quorumIsValid(owners.length, quorum_) {
        quorum = quorum_;
        emit QuorumChange(quorum_);
    }

    function submitTransaction(
        address dst_,
        uint256 value_,
        bytes calldata calldata_
    ) external onlyOwner(msg.sender) returns (uint256 txId) {
        require(dst_ != address(0), "zero address");
        txId = txsCount;
        txs[txId] = Transaction({
            dst: dst_,
            value: value_,
            data: calldata_,
            isExecuted: false,
            blockNumber: block.number
        });
        txsCount = txId + 1;
        emit Submission(txId);
    }

    function confirmTransaction(
        uint256 txId_
    ) external onlyOwner(msg.sender) whenNotConfirmed(txId_, msg.sender) {
        require(txs[txId_].dst != address(0), "txId is incorrect");
        confirms[txId_][msg.sender] = true;
        emit Confirmation(msg.sender, txId_);
    }

    function revokeConfirmation(
        uint256 txId_
    ) external onlyOwner(msg.sender) whenNotExecuted(txId_) {
        require(confirms[txId_][msg.sender], "tx is not confirmed");
        confirms[txId_][msg.sender] = false;
        emit Revocation(msg.sender, txId_);
    }

    function executeTransaction(
        uint256 txId_
    ) external whenNotExecuted(txId_) returns (bytes memory) {
        require(isConfirmed(txId_), "is not confirmed");
        Transaction storage tx_ = txs[txId_];
        require(tx_.blockNumber + ttl >= block.number, "tx too old");
        tx_.isExecuted = true;
        emit Execution(txId_, msg.sender);
        (bool success_, bytes memory data_) = tx_.dst.call{value: tx_.value}(
            tx_.data
        );
        if (success_) {
            return data_;
        } else {
            if (data_.length > 0) {
                /// @solidity memory-safe-assembly
                assembly {
                    let returndata_size := mload(data_)
                    revert(add(32, data_), returndata_size)
                }
            } else {
                revert("no error");
            }
        }
    }

    function isConfirmed(uint256 txId_) public view returns (bool) {
        uint128 count = 0;
        for (uint256 i = 0; i < owners.length; i++) {
            if (confirms[txId_][owners[i]]) count++;
            if (count >= quorum) return true;
        }

        return false;
    }

    function getConfirmationsCount(
        uint256 txId_
    ) external view returns (uint256 count) {
        for (uint256 i = 0; i < owners.length; i++)
            if (confirms[txId_][owners[i]]) count++;
    }

    function getConfirmations(
        uint256 txId_
    ) external view returns (address[] memory confirms_) {
        uint256 i = 0;
        uint256 count = 0;
        address[] memory tmp = new address[](owners.length);
        for (; i < owners.length; i++) {
            address owner = owners[i];
            if (confirms[txId_][owner]) {
                tmp[count] = owner;
                count++;
            }
        }

        confirms_ = new address[](count);
        for (i = 0; i < count; i++) confirms_[i] = tmp[i];
    }
}
