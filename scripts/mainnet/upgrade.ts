require('dotenv').config();
import { ethers, network, upgrades } from 'hardhat';

let contractName: string;
let contractAddress: string;

if (network.name === 'mainnet') {
  contractName = 'Pika';
  contractAddress = process.env.CONTRACT as string;
} else if (network.name === 'polygon') {
  contractName = 'PikaPolygon';
  contractAddress = process.env.CONTRACT_POLYGON as string;
} else {
  throw new Error('Unsupported network');
}

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
