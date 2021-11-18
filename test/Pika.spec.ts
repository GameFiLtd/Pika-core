require('dotenv').config();
import { BigNumber } from '@ethersproject/bignumber';
import { ContractTransaction } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { IERC20, IERC20__factory, IUniswapV2Router, IUniswapV2Router__factory, Pika, PikaLegacy } from '../typechain';

describe('Pika', () => {
  let pikaLegacy: PikaLegacy;
  let pika: Pika;
  let uniswap: IUniswapV2Router;
  let accounts: SignerWithAddress[];
  let uniswapRouter: string;
  const unix2100 = '4102441200';
  let owner: string;

  before(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0].address;
    const factory = await ethers.getContractFactory('PikaLegacy');
    pikaLegacy = (await upgrades.deployProxy(factory, [
      ethers.utils.parseEther('10000000000000'),
      ethers.utils.parseEther('50000000000000'),
      accounts[1].address,
      'PIKA',
      'PIKA',
      '500',
    ])) as PikaLegacy;
    uniswapRouter = await pikaLegacy.router();
    await pikaLegacy.setFeesEnabled(true);
    await pikaLegacy.setSwapEnabled(true);
    await pikaLegacy.approve(uniswapRouter, ethers.constants.MaxUint256);
    uniswap = IUniswapV2Router__factory.connect(uniswapRouter, accounts[0]);
    await uniswap.addLiquidityETH(
      pikaLegacy.address,
      ethers.utils.parseEther('10000000'),
      ethers.utils.parseEther('10000000'),
      ethers.utils.parseEther('20'),
      owner,
      unix2100,
      { value: ethers.utils.parseEther('20') }
    );
  });

  it('should be safe to upgrade contract', async () => {
    const factory = await ethers.getContractFactory('Pika');
    pika = (await upgrades.upgradeProxy(pikaLegacy.address, factory)) as Pika;
  });

  describe('Uniswap tests & transfer tests', async () => {
    let weth: IERC20;

    before(async () => {
      weth = IERC20__factory.connect(await pika.WETH(), accounts[0]);
      await pika.setExcludeFromFee(owner, false);
    });

    it('should not take a fee on wallet to wallet transfer', async () => {
      const tx = pika.transfer(accounts[1].address, ethers.utils.parseEther('1000000'));
      await expect(tx)
        .to.emit(pika, 'Transfer')
        .withArgs(owner, accounts[1].address, ethers.utils.parseEther('1000000'));
      await expect(tx).to.not.emit(weth, 'Transfer');
    });

    describe('should take fee and autoswap on any interaction with uniswap', async () => {
      let balance1: BigNumber;
      let balance2: BigNumber;
      const amount = ethers.utils.parseEther('1000');
      const fee = amount.div(20);
      let tx: Promise<ContractTransaction>;

      before(async () => {
        await pika.setStaking(accounts[2].address, '4000');
        balance1 = await pika.provider.getBalance(accounts[1].address);
        balance2 = await pika.provider.getBalance(accounts[2].address);
        tx = uniswap.swapExactTokensForETHSupportingFeeOnTransferTokens(
          amount,
          '0',
          [pika.address, weth.address],
          accounts[0].address,
          unix2100
        );
      });

      it('should transfer amount minus fee to uniswap', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(owner, await pika.uniswapPair(), amount.sub(fee));
      });
      it('should transfer fee to uniswap', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(pika.address, await pika.uniswapPair(), fee);
      });
      it('should pay out ETH rewards to beneficiary', async () => {
        expect((await pika.provider.getBalance(accounts[1].address)).gt(balance1)).to.be.true;
      });
      it('should pay out ETH rewards to staking', async () => {
        expect((await pika.provider.getBalance(accounts[2].address)).gt(balance2)).to.be.true;
      });
    });
  });
});
