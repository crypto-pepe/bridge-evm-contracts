import { ethers } from "hardhat";
import { MULTISIG_TTL_DEFAULT } from "../test/data/constants";
import { stepInit } from "./multisig";

export const deployMultisigFixtureOneOwner = async () => {
  return await deployMultisig();
};

export const deployMultisigOneOwnerWithInit = async () => {
  const ret = await deployMultisigFixtureOneOwner();
  await stepInit(ret.multisig, [ret.owner.address], 1, MULTISIG_TTL_DEFAULT);
  return ret;
};

export const deployMultisigFixtureManyOwners = async () => {
  const ret = await deployMultisigFixtureOneOwner();
  await stepInit(
    ret.multisig,
    [ret.owner.address, ret.other.address],
    2,
    MULTISIG_TTL_DEFAULT
  );
  return ret;
};

export const deployMultisig = async () => {
  const [owner, other, third] = await ethers.getSigners();
  const Multisig = await ethers.getContractFactory("Multisig");
  const multisig = await Multisig.deploy();

  return {
    multisig,
    owner,
    other,
    third,
    Multisig,
  };
};
