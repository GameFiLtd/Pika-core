require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { Pika, Pika__factory } from '../../../typechain';

const contractName = 'Liquidity';
const constructorParams: any[] = [process.env.CONTRACT, process.env.PAIR];

async function main(contractName: string, constructorParams?: any[]): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account:', deployer.address);
  const Contract = (await ethers.getContractFactory(contractName)) as Pika__factory;
  const contract = (await upgrades.deployProxy(Contract, constructorParams!)) as Pika;
  await contract.deployed();
  console.log('Contract address:', contract.address);

  const pika = Pika__factory.connect(process.env.CONTRACT as string, deployer);

  let tx = await pika.setBeneficiary(process.env.BENEFICIARY as string, '175');
  console.log('Setting beneficiary fee to 1.75%', tx.hash);
  await tx.wait();
  tx = await pika.setLiquidity(contract.address, '100');
  console.log('Setting liquidity fee to 1%', tx.hash);
  await tx.wait();
}

main(contractName, constructorParams)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
