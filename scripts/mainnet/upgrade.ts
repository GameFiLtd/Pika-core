require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { Pika, Pika__factory } from '../../typechain';

const contractName = 'Pika';

async function main(contractName: string): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Upgrading contract with the account:', deployer.address);
  const Contract = (await ethers.getContractFactory(contractName)) as Pika__factory;
  const contract = (await upgrades.upgradeProxy(process.env.CONTRACT as string, Contract)) as Pika;
  console.log('Contract address:', contract.address);
}

main(contractName)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
