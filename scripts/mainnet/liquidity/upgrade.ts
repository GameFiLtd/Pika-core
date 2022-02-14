require('dotenv').config();
import { ethers, upgrades } from 'hardhat';

let contractName = 'Liquidity';
let contractAddress = process.env.LIQUIDITY as string;

async function main(contractName: string): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Upgrading contract with the account:', deployer.address);
  const Contract = await ethers.getContractFactory(contractName);
  const contract = await upgrades.upgradeProxy(contractAddress, Contract);
  console.log('Contract address:', contract.address);
}

main(contractName)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
