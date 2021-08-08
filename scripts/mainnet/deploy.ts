require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { Pika, Pika__factory } from '../../typechain';

const contractName = 'Pika';
const constructorParams: any[] = [
  ethers.utils.parseEther('10000000000000'),
  ethers.utils.parseEther('50000000000000'),
  process.env.BENEFICIARY,
  'PIKA',
  'PIKA',
  '275',
];

async function main(contractName: string, constructorParams?: any[]): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account:', deployer.address);
  const Contract = (await ethers.getContractFactory(contractName)) as Pika__factory;
  const contract = (await upgrades.deployProxy(Contract, constructorParams!)) as Pika;
  await contract.deployed();
  console.log('Contract address:', contract.address);
  let tx = await contract.approve('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', ethers.constants.MaxUint256);
  console.log('Approving', tx.hash);
  await tx.wait();
}

main(contractName, constructorParams)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
