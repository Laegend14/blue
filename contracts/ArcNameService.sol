// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArcNameService {
    mapping(bytes32 => address) private nameOwners;
    mapping(address => string) private primaryNames;

    event NameRegistered(address indexed owner, string label);

    function register(string calldata label) external {
        _validateLabel(label);

        require(bytes(primaryNames[msg.sender]).length == 0, "ADDRESS_HAS_NAME");

        bytes32 node = _node(label);
        require(nameOwners[node] == address(0), "NAME_TAKEN");

        nameOwners[node] = msg.sender;
        primaryNames[msg.sender] = label;

        emit NameRegistered(msg.sender, label);
    }

    function addressOf(string calldata label) external view returns (address) {
        return nameOwners[_node(label)];
    }

    function nameOf(address owner) external view returns (string memory) {
        return primaryNames[owner];
    }

    function available(string calldata label) external view returns (bool) {
        _validateLabel(label);
        return nameOwners[_node(label)] == address(0);
    }

    function _node(string calldata label) private pure returns (bytes32) {
        return keccak256(bytes(label));
    }

    function _validateLabel(string calldata label) private pure {
        bytes calldata value = bytes(label);
        require(value.length >= 3 && value.length <= 32, "INVALID_LENGTH");
        require(value[0] != "-" && value[value.length - 1] != "-", "INVALID_HYPHEN");

        for (uint256 index = 0; index < value.length; index++) {
            bytes1 char = value[index];
            bool isLowerAlpha = char >= "a" && char <= "z";
            bool isNumber = char >= "0" && char <= "9";
            bool isHyphen = char == "-";

            require(isLowerAlpha || isNumber || isHyphen, "INVALID_CHARACTER");
        }
    }
}
