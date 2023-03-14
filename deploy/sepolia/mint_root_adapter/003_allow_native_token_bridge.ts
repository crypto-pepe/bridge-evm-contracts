import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
const main: DeployFunction = async function (hre: any) {
  const { deployer } = await hre.getNamedAccounts();
  const { get, execute, read } = hre.deployments;

  const coinBridge = await get("CoinBridge_Proxy");
  if (
    (await read("MintRootAdapter", "allowance", coinBridge.address)) != true
  ) {
    const bridgeAdapter = await get("MintRootAdapter_Proxy");
    let iface = new hre.ethers.utils.Interface([
      "function allow(address caller_)",
    ]);
    const calldata = iface.encodeFunctionData("allow", [coinBridge.address]);
    await execute(
      "Multisig",
      {
        from: deployer,
        log: true,
      },
      "submitTransaction",
      bridgeAdapter.address,
      0,
      calldata
    );
  }
};

main.id = "ethereum_sepolia_allow_coin_bridge";
main.tags = ["ethereum", "sepolia", "MintRootAdapter"];
main.dependencies = [
  "ethereum_sepolia_multisig_deploy",
  "ethereum_sepolia_mint_root_adapter_deploy",
  "ethereum_sepolia_coin_bridge_deploy",
];

export default main;
