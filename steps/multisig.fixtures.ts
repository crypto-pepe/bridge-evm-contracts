import { ethers } from "hardhat";
import { MULTISIG_TTL_DEFAULT } from "../test/data/constants";
import { stepInit } from "./multisig";

export const deployMultisigFixtureOneAdmin = async () => {
  return await deployMultisig();
};

export const deployMultisigOneAdminWithInit = async () => {
  const ret = await deployMultisigFixtureOneAdmin();
  await stepInit(ret.multisig, [ret.admin.address], 1, MULTISIG_TTL_DEFAULT);
  return ret;
};

export const deployMultisigFixtureManyAdmins = async () => {
  const ret = await deployMultisigFixtureOneAdmin();
  await stepInit(
    ret.multisig,
    [ret.admin.address, ret.other.address],
    2,
    MULTISIG_TTL_DEFAULT
  );
  return ret;
};

export const deployMultisig = async () => {
  const [admin, other, third] = await ethers.getSigners();
  const Multisig = await ethers.getContractFactory("Multisig");
  const multisig = await Multisig.deploy();

  return {
    multisig,
    admin,
    other,
    third,
    Multisig,
  };
};
