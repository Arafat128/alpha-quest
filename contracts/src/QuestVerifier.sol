// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice v2 stub. Wire @primuslabs/zktls-contracts IPrimusZKTLS when deploying.
interface IPrimusZKTLS {
    struct Attestation {
        address recipient;
        bytes request;
        bytes reponseResolve;
        string data;
        string attConditions;
        uint64 timestamp;
        string additionParams;
        bytes[] signatures;
    }

    function verifyAttestation(Attestation calldata attestation) external view;
}

contract QuestVerifier {
    IPrimusZKTLS public immutable primus;

    constructor(address primusAddress) {
        primus = IPrimusZKTLS(primusAddress);
    }

    function check(IPrimusZKTLS.Attestation calldata attestation) external view returns (bool) {
        primus.verifyAttestation(attestation);
        return true;
    }
}
