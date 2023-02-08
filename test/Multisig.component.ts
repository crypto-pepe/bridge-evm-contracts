import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect, use } from "chai";
import { MULTISIG_TTL_DEFAULT, ZERO_ADDRESS } from "./data/constants";
import chaiAsPromised from "chai-as-promised";
import {
  expectConfirmTransaction,
  expectRevokeConfirmation,
  expectSubmitTransaction,
  expectExecuteTransaction,
  setQuorumEncode,
  stepInit,
} from "../steps/multisig";
import { BigNumber } from "ethers";
import {
  deployMultisig,
  deployMultisigFixtureManyOwners,
  deployMultisigFixtureOneOwner,
  deployMultisigOneOwnerWithInit,
} from "../steps/multisig.fixtures";
import { ethers } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";

use(chaiAsPromised);

describe("Multisig", () => {
  describe("smoke tests", () => {
    it("simple positive", async () => {
      const { multisig, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await stepInit(multisig, [other.address], 1, MULTISIG_TTL_DEFAULT);
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        other,
        setQuorumEncode(multisig),
        BigNumber.from(0n),
        startTxId
      );
      await expectConfirmTransaction(multisig, other, startTxId);
      await expectRevokeConfirmation(multisig, other, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      await expectExecuteTransaction(multisig, other, startTxId);
    });
  });

  describe("should be initialized", () => {
    it("should throw when empty owners array", async () => {
      const { multisig } = await loadFixture(deployMultisigFixtureOneOwner);
      return expect(
        multisig.init([""], 1, MULTISIG_TTL_DEFAULT)
      ).be.rejectedWith("resolver or addr is not configured for ENS name");
    });

    it("should throw when quorum == 0", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      return expect(
        multisig.init([owner.address], 0, MULTISIG_TTL_DEFAULT)
      ).be.rejectedWith("invalid quorum");
    });

    it("should throw when quorum more than owners length", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      return expect(
        multisig.init([owner.address, other.address], 3, MULTISIG_TTL_DEFAULT)
      ).be.rejectedWith("invalid quorum");
    });

    it("should throw when owner array contains zero address", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      return expect(
        multisig.init([owner.address, ZERO_ADDRESS], 1, MULTISIG_TTL_DEFAULT)
      ).be.rejectedWith("zero address");
    });

    it("should throw when owner array contains duplicates", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );

      return expect(
        multisig.init(
          [owner.address, other.address, owner.address],
          2,
          MULTISIG_TTL_DEFAULT
        )
      ).be.rejectedWith("owner is duplicated");
    });

    it("should be started correctly", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await multisig.init([owner.address], 1, MULTISIG_TTL_DEFAULT);
      expect(await multisig.quorum()).to.be.equal(1);
      expect(await multisig.owners(0)).to.be.equal(owner.address);
      expect(await multisig.isOwner(owner.address)).is.true;
      expect(await multisig.isOwner(other.address)).is.false;
    });
  });

  describe("should be ownable", () => {
    it("should throw when no-owner call submitTransaction", async () => {
      const { multisig, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await expect(
        multisig
          .connect(other)
          .submitTransaction(other.address, 0, setQuorumEncode(multisig))
      ).to.be.revertedWith("only owner");
    });

    it("should throw when no-owner call confirmTransaction", async () => {
      const { multisig, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await expect(
        multisig.connect(other).confirmTransaction(0)
      ).to.be.revertedWith("only owner");
    });

    it("should throw when no-owner call revokeConfirmation", async () => {
      const { multisig, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await expect(
        multisig.connect(other).revokeConfirmation(0)
      ).to.be.revertedWith("only owner");
    });
  });

  describe("should be self-callable", () => {
    it("should throw when no-self call addOwner", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await expect(
        multisig.connect(owner).addOwner(other.address)
      ).to.be.revertedWith("only self");
    });

    it("should throw when no-self call removeOwner", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await expect(
        multisig.connect(owner).removeOwner(other.address)
      ).to.be.revertedWith("only self");
    });

    it("should throw when no-self call setQuorum", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await expect(multisig.connect(owner).setQuorum(1)).to.be.revertedWith(
        "only self"
      );
    });
  });

  describe("executeTransaction functional tests", () => {
    it("can executeTransaction", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigOneOwnerWithInit
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      const beforeTx = await multisig.txs(startTxId);
      expect(beforeTx.isExecuted).is.false;
      await expectExecuteTransaction(multisig, owner, startTxId);
      const afterTx = await multisig.txs(startTxId);
      expect(afterTx.isExecuted).is.true;
    });

    it("should throw when transaction re-execute", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigOneOwnerWithInit
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );

      await expectConfirmTransaction(multisig, owner, startTxId);
      const beforeTx = await multisig.txs(startTxId);
      expect(beforeTx.isExecuted).is.false;
      await expectExecuteTransaction(multisig, owner, startTxId);
      const afterTx = await multisig.txs(startTxId);
      expect(afterTx.isExecuted).is.true;
      await expect(
        multisig.connect(owner).executeTransaction(startTxId)
      ).to.be.revertedWith("tx is executed");
      const checkTx = await multisig.txs(startTxId);
      expect(checkTx.isExecuted).is.true;
    });

    it("should throw when transaction not confirmed", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigOneOwnerWithInit
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      const beforeTx = await multisig.txs(startTxId);
      expect(beforeTx.isExecuted).is.false;
      await expect(
        multisig.connect(owner).executeTransaction(startTxId)
      ).to.be.revertedWith("is not confirmed");
      const afterTx = await multisig.txs(startTxId);
      expect(afterTx.isExecuted).is.false;
    });

    it("should throw when calldata is wrong", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigOneOwnerWithInit
      );
      const startTxId = await multisig.txsCount();
      await expect(
        await multisig
          .connect(owner)
          .submitTransaction(
            multisig.address,
            0,
            Buffer.from(multisig.interface.encodeFunctionData("setQuorum", [1]))
          )
      )
        .to.emit(multisig, "Submission")
        .withArgs(startTxId);
      await expectConfirmTransaction(multisig, owner, startTxId);

      const beforeTx = await multisig.txs(startTxId);
      expect(beforeTx.isExecuted).is.false;

      await expect(
        expectExecuteTransaction(multisig, owner, startTxId)
      ).to.be.revertedWith("no error");
      const afterTx = await multisig.txs(startTxId);
      expect(afterTx.isExecuted).is.false;
    });

    it("can execute transaction when block height is equals TTL", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await multisig.init([owner.address], 1, 2); // because on execute block number added on 1
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      const beforeTx = await multisig.txs(startTxId);
      expect(beforeTx.isExecuted).is.false;
      await expectExecuteTransaction(multisig, owner, startTxId);
      const afterTx = await multisig.txs(startTxId);
      expect(afterTx.isExecuted).is.true;
    });

    it("should throw when block's height more than TTL", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await multisig.init([owner.address], 1, 1);
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await mine(3);
      await expect(
        expectExecuteTransaction(multisig, owner, startTxId)
      ).to.be.revertedWith("tx too old");
    });
  });

  describe("isConfirmed functional tests", () => {
    it("should be true when quorum is 1", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await multisig.init([owner.address], 1, MULTISIG_TTL_DEFAULT);
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0n),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(await multisig.connect(owner).isConfirmed(startTxId)).is.true;
    });

    it("should be false when txId incorrect", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureOneOwner
      );
      await multisig.init(
        [owner.address, other.address],
        2,
        MULTISIG_TTL_DEFAULT
      );
      expect(await multisig.connect(owner).isConfirmed(31337n)).is.false;
    });

    it("can check isConfirmed", async () => {
      const { multisig, owner, other } = await loadFixture(deployMultisig);
      await multisig.init(
        [owner.address, other.address],
        2,
        MULTISIG_TTL_DEFAULT
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0n),
        startTxId
      );
      expect(await multisig.connect(owner).isConfirmed(startTxId)).is.false;
    });

    it("check isConfirmed by no-owner", async () => {
      const { multisig, owner, other, third } = await loadFixture(
        deployMultisig
      );
      await multisig.init(
        [owner.address, other.address],
        2,
        MULTISIG_TTL_DEFAULT
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0n),
        startTxId
      );
      expect(await multisig.connect(third).isConfirmed(startTxId)).is.false;
    });

    it("should be false when 1 confirmation with 2 quorum", async () => {
      const { multisig, owner, other } = await loadFixture(deployMultisig);
      await multisig.init(
        [owner.address, other.address],
        2,
        MULTISIG_TTL_DEFAULT
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0n),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.true;
      expect(await multisig.connect(owner).isConfirmed(startTxId)).is.false;
    });
  });

  describe("addOwner functional tests", () => {
    it("can add new owner", async () => {
      const { multisig, owner, other, third } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      expect(await multisig.isOwner(other.address)).is.true;
      expect(await multisig.isOwner(third.address)).is.false;

      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        multisig.interface.encodeFunctionData("addOwner", [third.address]),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      expect(await multisig.isOwner(third.address)).is.false;
      await expectExecuteTransaction(multisig, owner, startTxId);
      expect(await multisig.isOwner(third.address)).is.true;
    });

    it("should throw when try to add duplicate owner", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      expect(await multisig.isOwner(other.address)).is.true;
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        multisig.interface.encodeFunctionData("addOwner", [other.address]),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      await expect(
        expectExecuteTransaction(multisig, owner, startTxId)
      ).to.be.revertedWith("only not owner");
    });

    it("should throw when owner with zero address", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      expect(await multisig.isOwner(other.address)).is.true;
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        multisig.interface.encodeFunctionData("addOwner", [ZERO_ADDRESS]),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      await expect(
        expectExecuteTransaction(multisig, owner, startTxId)
      ).to.be.revertedWith("zero address");
    });
  });

  describe("removeOwner functional tests", () => {
    it("can remove owner", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      expect(await multisig.quorum()).to.be.equal(2);
      const startTxId = await multisig.txsCount();
      expect(await multisig.isOwner(other.address)).is.true;
      await expectSubmitTransaction(
        multisig,
        owner,
        multisig.interface.encodeFunctionData("removeOwner", [owner.address]),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      await expectExecuteTransaction(multisig, other, startTxId);
      expect(await multisig.isOwner(owner.address)).is.false;
      expect(await multisig.isOwner(other.address)).is.true;
      expect(await multisig.quorum()).to.be.equal(1);
    });

    it("can remove owner without change quorum", async () => {
      const { multisig, owner, other, third } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      expect(await multisig.isOwner(other.address)).is.true;
      expect(await multisig.isOwner(owner.address)).is.true;
      let startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        multisig.interface.encodeFunctionData("addOwner", [third.address]),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      await expectExecuteTransaction(multisig, owner, startTxId);
      expect(await multisig.isOwner(third.address)).is.true;
      expect(await multisig.quorum()).to.be.equal(2);
      startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        multisig.interface.encodeFunctionData("removeOwner", [owner.address]),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      await expectExecuteTransaction(multisig, other, startTxId);
      expect(await multisig.isOwner(owner.address)).is.false;
      expect(await multisig.isOwner(other.address)).is.true;
      expect(await multisig.isOwner(third.address)).is.true;
      expect(await multisig.quorum()).to.be.equal(2);
    });

    it("owner can be removed only by other owner", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      expect(await multisig.isOwner(other.address)).is.true;
      await expectSubmitTransaction(
        multisig,
        owner,
        multisig.interface.encodeFunctionData("removeOwner", [other.address]),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      await expectExecuteTransaction(multisig, other, startTxId);
      expect(await multisig.isOwner(owner.address)).is.true;
      expect(await multisig.isOwner(other.address)).is.false;
    });

    it("can remove last owner", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      expect(await multisig.isOwner(other.address)).is.true;
      let txId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        multisig.interface.encodeFunctionData("removeOwner", [other.address]),
        BigNumber.from(0),
        txId
      );
      await expectConfirmTransaction(multisig, owner, txId);
      await expectConfirmTransaction(multisig, other, txId);
      await expect(multisig.connect(owner).executeTransaction(txId)).to.be.emit(
        multisig,
        "Execution"
      );
      expect(await multisig.isOwner(owner.address)).is.true;
      expect(await multisig.isOwner(other.address)).is.false;
      expect(await multisig.quorum()).to.be.equal(1);
      txId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        multisig.interface.encodeFunctionData("removeOwner", [owner.address]),
        BigNumber.from(0),
        txId
      );
      await expectConfirmTransaction(multisig, owner, txId);
      await expect(
        multisig.connect(owner).executeTransaction(txId)
      ).to.be.rejectedWith("invalid quorum");
      expect(await multisig.isOwner(owner.address)).is.true;
      expect(await multisig.quorum()).to.be.equal(1);
    });
  });

  describe("setQuorum functional tests", () => {
    it("can update quorum value", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig, 1),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      await expectExecuteTransaction(multisig, other, startTxId);
      expect(await multisig.quorum()).to.be.equal(1);
    });

    it("should throw when set quorum = 0", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig, 0),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      await expectConfirmTransaction(multisig, other, startTxId);
      await expect(
        expectExecuteTransaction(multisig, other, startTxId)
      ).to.be.revertedWith("invalid quorum");
      expect(await multisig.quorum()).to.be.equal(2);
    });
  });

  describe("submitTransaction functional tests", () => {
    it("should throw when address is zero", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      await expect(
        multisig
          .connect(owner)
          .submitTransaction(ZERO_ADDRESS, 0, setQuorumEncode(multisig))
      ).to.be.revertedWith("zero address");
    });

    it("submitTransaction works with various addresses:", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expect(
        await multisig
          .connect(owner)
          .submitTransaction(other.address, 0, setQuorumEncode(multisig))
      )
        .to.emit(multisig, "Submission")
        .withArgs(startTxId);
      expect(await multisig.txsCount()).to.be.greaterThan(startTxId);
    });

    it("submitTransaction works with value in BigNumber diapason", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(1000000000000000000n),
        startTxId
      );
      expect(await multisig.txsCount()).to.be.greaterThan(startTxId);
    });

    it("submitTransaction works with various calldata", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        ZERO_ADDRESS,
        BigNumber.from(0),
        startTxId
      );
      expect(await multisig.txsCount()).to.be.greaterThan(startTxId);
    });
  });

  describe("confirmTransaction functional tests", () => {
    it("owner can confirm transaction", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );

      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.true;
    });

    // No repeat! Another case =)
    it("should throw wneh no-owner try to confirm transaction", async () => {
      const { multisig, owner, third } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      await expect(
        multisig.connect(third).confirmTransaction(startTxId)
      ).to.be.revertedWith("only owner");
    });

    it("should throw when try to confirm incorrect txId", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      await expect(
        multisig.connect(owner).confirmTransaction(31337n)
      ).to.be.revertedWith("txId is incorrect");
      expect(await multisig.confirms(startTxId, owner.address)).is.false;
    });

    it("should throw wneh try to re-confirm transaction", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.true;
      await expect(
        multisig.connect(owner).confirmTransaction(startTxId)
      ).to.be.revertedWith("tx is confirmed");
      expect(await multisig.confirms(startTxId, owner.address)).is.true;
    });
  });

  describe("revokeConfirmation functional tests", () => {
    it("can revoke confirmation", async function() {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      expect(await multisig.confirms(startTxId, owner.address)).is.false;

      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.true;

      await expectRevokeConfirmation(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.false;
    });

    it("revoke confirmation in multisig", async () => {
      const { multisig, owner, other } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      expect(await multisig.confirms(startTxId, owner.address)).is.false;
      expect(await multisig.confirms(startTxId, other.address)).is.false;

      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.true;
      expect(await multisig.confirms(startTxId, other.address)).is.false;

      await expectConfirmTransaction(multisig, other, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.true;
      expect(await multisig.confirms(startTxId, other.address)).is.true;

      await expectRevokeConfirmation(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.false;
      expect(await multisig.confirms(startTxId, other.address)).is.true;
    });

    it("should throw when revoked with incorrect txId", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      expect(await multisig.confirms(startTxId, owner.address)).is.false;
      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.true;

      await expect(
        multisig.connect(owner).revokeConfirmation(31337n)
      ).to.revertedWith("tx is not confirmed");
      expect(await multisig.confirms(startTxId, owner.address)).is.true;
    });

    it("should throw on confirmation re-revoke", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      expect(await multisig.confirms(startTxId, owner.address)).is.false;

      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.true;

      await expectRevokeConfirmation(multisig, owner, startTxId);
      expect(await multisig.confirms(startTxId, owner.address)).is.false;

      await expect(
        multisig.connect(owner).revokeConfirmation(startTxId)
      ).to.revertedWith("tx is not confirmed");
      expect(await multisig.confirms(startTxId, owner.address)).is.false;
    });

    it("can many times confirm and revoke transaction", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      expect(await multisig.confirms(startTxId, owner.address)).is.false;

      for (let i = 0; i < 32; i++) {
        await expectConfirmTransaction(multisig, owner, startTxId);
        expect(await multisig.confirms(startTxId, owner.address)).is.true;

        await expectRevokeConfirmation(multisig, owner, startTxId);
        expect(await multisig.confirms(startTxId, owner.address)).is.false;
      }
    });
  });

  describe("getConfirmationsCount functional tests", () => {
    it("can get confirmations count", async function() {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      expect(
        await multisig.connect(owner).getConfirmationsCount(startTxId)
      ).to.be.equal(0);
      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(
        await multisig.connect(owner).getConfirmationsCount(startTxId)
      ).to.be.equal(1);
    });

    it("no-owner also can get confirmations count", async () => {
      const { multisig, owner, third } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      expect(
        await multisig.connect(third).getConfirmationsCount(startTxId)
      ).to.be.equal(1);
    });

    it("should get 0 when txId incorrect", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      expect(
        await multisig.connect(owner).getConfirmationsCount(31337n)
      ).to.be.equal(0);
    });
  });

  describe("getConfirmations functional tests", () => {
    it("can get confirmations", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0n),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      const confirmations = await multisig
        .connect(owner)
        .getConfirmations(startTxId);
      expect(confirmations).to.be.deep.equal([owner.address]);
    });

    it("no-owner also can get confirmations", async () => {
      const { multisig, owner, third } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0n),
        startTxId
      );
      await expectConfirmTransaction(multisig, owner, startTxId);
      const confirmations = await multisig
        .connect(third)
        .getConfirmations(startTxId);
      expect(confirmations).to.be.deep.equal([owner.address]);
    });

    it("should get empty confirmations", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const startTxId = await multisig.txsCount();
      await expectSubmitTransaction(
        multisig,
        owner,
        setQuorumEncode(multisig),
        BigNumber.from(0n),
        startTxId
      );
      const confirmations = await multisig
        .connect(owner)
        .getConfirmations(startTxId);
      expect(confirmations).to.be.deep.equal([]);
    });

    it("should get empty confirmations with incorrect txId", async () => {
      const { multisig, owner } = await loadFixture(
        deployMultisigFixtureManyOwners
      );
      const confirmations = await multisig
        .connect(owner)
        .getConfirmations(31337n);
      expect(confirmations).to.be.deep.equal([]);
    });
  });

  /**
   * TODO:  8) [???] check possible empty owners idx where isOwner = true
   */
});
