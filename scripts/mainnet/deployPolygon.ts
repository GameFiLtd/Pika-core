require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { PikaPolygon, PikaPolygon__factory } from '../../typechain';

const contractName = 'PikaPolygon';
const constructorParams: any[] = ['0', '0', process.env.BENEFICIARY, 'PIKA', 'PIKA', '275'];

async function main(contractName: string, constructorParams?: any[]): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account:', deployer.address);
  const Contract = (await ethers.getContractFactory(contractName)) as PikaPolygon__factory;
  const contract = (await upgrades.deployProxy(Contract, constructorParams!)) as PikaPolygon;
  await contract.deployed();
  console.log('Contract address:', contract.address);
}

main(contractName, constructorParams)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
