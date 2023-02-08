import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { Multisig } from "../typechain-types/Multisig";
import { expect } from "chai";

export const expectSubmitTransaction = async (
  multisig: Multisig,
  invoker: SignerWithAddress,
  data: string,
  value: BigNumber,
  txId: BigNumber
) =>
  await expect(
    await multisig
      .connect(invoker)
      .submitTransaction(multisig.address, value, data)
  )
    .to.emit(multisig, "Submission")
    .withArgs(txId);

export const expectConfirmTransaction = async (
  multisig: Multisig,
  invoker: SignerWithAddress,
  txId: BigNumber
) =>
  await expect(await multisig.connect(invoker).confirmTransaction(txId))
    .to.emit(multisig, "Confirmation")
    .withArgs(invoker.address, txId);

export const expectRevokeConfirmation = async (
  multisig: Multisig,
  invoker: SignerWithAddress,
  txId: BigNumber
) =>
  await expect(await multisig.connect(invoker).revokeConfirmation(txId))
    .to.emit(multisig, "Revocation")
    .withArgs(invoker.address, txId);

export const expectExecuteTransaction = async (
  multisig: Multisig,
  invoker: SignerWithAddress,
  txId: BigNumber
) =>
  await expect(await multisig.connect(invoker).executeTransaction(txId))
    .to.emit(multisig, "Execution")
    .withArgs(txId, invoker.address);

export const setQuorumEncode = (multisig: Multisig, quorum = 1) =>
  multisig.interface.encodeFunctionData("setQuorum", [quorum]);

export const stepInit = async (
  multisig_: Multisig,
  owners_: string[],
  quorum_: number,
  ttl_: number
) => {
  await multisig_.init(owners_, quorum_, ttl_);
  expect(await multisig_.owners(0)).to.be.equal(owners_[0]);
  expect(await multisig_.quorum()).to.be.equal(quorum_);
  expect(await multisig_.ttl()).to.be.equal(ttl_);
};
