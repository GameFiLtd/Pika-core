require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { IUniswapV2Router__factory, Pika, Pika__factory } from '../../typechain';

const contractName = 'Pika';
const constructorParams: any[] = [
  ethers.utils.parseEther('1000000'),
  ethers.utils.parseEther('1000000000'),
  process.env.DEV_BENEFICIARY,
  'Test Token',
  'TST',
  '275',
];

async function main(contractName: string, constructorParams?: any[]): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contract with the account:', deployer.address);
  const Contract = (await ethers.getContractFactory(contractName)) as Pika__factory;
  const contract = (await upgrades.deployProxy(Contract, constructorParams!)) as Pika;
  await contract.deployed();
  console.log('Contract address:', contract.address);
  const uniswap = IUniswapV2Router__factory.connect('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', deployer);
  let tx = await contract.approve(uniswap.address, ethers.constants.MaxUint256);
  console.log('Approving', tx.hash);
  await tx.wait();
  tx = await uniswap.addLiquidityETH(
    contract.address,
    ethers.utils.parseEther('10000000'),
    ethers.utils.parseEther('10000000'),
    ethers.utils.parseEther('20'),
    await deployer.getAddress(),
    '4102441200',
    { value: ethers.utils.parseEther('20') }
  );
  console.log('Adding liquidity', tx.hash);
  await tx.wait();
  tx = await contract.setFeesEnabled(true);
  console.log('Enabling fees', tx.hash);
  await tx.wait();
  tx = await contract.setSwapEnabled(true);
  console.log('Enabling swap', tx.hash);
  await tx.wait();
}

main(contractName, constructorParams)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
