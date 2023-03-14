import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
const main: any = async function (hre: any) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  const multisig = await get("Multisig_Proxy");
  const rootAdapter = await get("MintRootAdapter_Proxy");
  const wavesCaller = "0x09Ec91c31506D756F54cbAc0C7CEB6810385e4DC";
  const wrappedContract = "3Mx4GxjrawhKHBgMKH9C5Hmbj8ePZDrs8ed";

  await deploy("WavesMintAdapter", {
    from: deployer,
    log: true,
    proxy: {
      owner: multisig.address,
      execute: {
        init: {
          methodName: "init",
          args: [
            multisig.address,
            wavesCaller,
            rootAdapter.address,
            wrappedContract,
          ],
        },
      },
    },
  });
};

main.id = "ethereum_sepolia_waves_mint_adapter_deploy";
main.tags = ["ethereum", "sepolia", "WavesMintAdapter"];
main.dependencies = [
  "ethereum_sepolia_multisig_deploy",
  "ethereum_sepolia_mint_root_adapter_deploy",
];

export default main;
