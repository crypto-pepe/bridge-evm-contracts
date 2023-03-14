import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// const main: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
const main: DeployFunction = async function (hre: any) {
  const { deployer } = await hre.getNamedAccounts();
  const { get, execute, read } = hre.deployments;

  const wavesChainId = 10001;
  const executionAsset = "3MtRCt6kNXiXkMrJtocy1fSq5fettopchtP";

  if ((await read("CoinBridge", "bindings", wavesChainId)).enabled != true) {
    const nativeTokenBridge = await get("CoinBridge_Proxy");
    let iface = new hre.ethers.utils.Interface([
      "function updateBindingInfo(uint16 executionChainId_, string calldata executionAsset_, " +
        "uint256 minAmount_, uint256 minFee_, uint256 thresholdFee_, " +
        "uint128 beforePercentFee_, uint128 afterPercentFee_, bool enabled_)",
    ]);
    const calldata = iface.encodeFunctionData("updateBindingInfo", [
      wavesChainId,
      executionAsset,
      10n ** 15n, // 0.001 ETH min amount
      5n * 10n ** 14n, // 0.0005 ETH min fee
      10n ** 19n, // 10 ETH threshold
      1000, // 0.001 = 0.1%
      900, // 0.0009 = 0.09%
      true, // enabled
    ]);
    await execute(
      "Multisig",
      {
        from: deployer,
        log: true,
      },
      "submitTransaction",
      nativeTokenBridge.address,
      0,
      calldata
    );
  }
};

main.id = "ethereum_sepolia_coin_bridge_enable_ETH";
main.tags = ["ethereum", "sepolia", "CoinBridge"];
main.dependencies = [
  "ethereum_sepolia_multisig_deploy",
  "ethereum_sepolia_coin_bridge_deploy",
];

export default main;
