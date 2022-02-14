require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { Liquidity, Liquidity__factory, Metra__factory } from '../../../typechain';

const contractName = 'Liquidity';

async function main(contractName: string): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account:', deployer.address);
  const metra = Metra__factory.connect(process.env.METRA as string, deployer);
  const constructorParams: any[] = [metra.address, await metra.uniswapPair()];

  const factory = (await ethers.getContractFactory(contractName)) as Liquidity__factory;
  const contract = (await upgrades.deployProxy(factory, constructorParams!)) as Liquidity;
  await contract.deployed();
  console.log('Contract address:', contract.address);

  let tx = await metra.setLiquidity(contract.address, '500');
  console.log('Setting liquidity fee to 5%', tx.hash);
  await tx.wait();

  tx = await metra.setFeesEnabled(true);
  console.log('Enabling fees', tx.hash);
  await tx.wait();

  tx = await metra.setSwapEnabled(true);
  console.log('Enabling swaps', tx.hash);
  await tx.wait();
}

main(contractName)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
