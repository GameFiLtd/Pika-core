require('dotenv').config();
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import {
  IUniswapV2Pair,
  IUniswapV2Pair__factory,
  IUniswapV2Router__factory,
  Liquidity,
  Liquidity__factory,
  Pika,
  Pika__factory,
} from '../typechain/';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Liquidity', () => {
  let liquidity: Liquidity;
  let pika: Pika;
  let pair: IUniswapV2Pair;
  let accounts: SignerWithAddress[];
  const uniswapRouter = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  const unix2100 = '4102441200';
  let owner: string;
  const lockPeriod = 10000;
  const vestingPeriod = lockPeriod * 2;

  before(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0].address;
    const PikaFactory = (await ethers.getContractFactory('Pika')) as Pika__factory;
    pika = (await upgrades.deployProxy(PikaFactory, [
      ethers.utils.parseEther('10000000000000'),
      ethers.utils.parseEther('50000000000000'),
      accounts[1].address,
      'PIKA',
      'PIKA',
      '275',
    ])) as Pika;
    await pika.approve(uniswapRouter, ethers.constants.MaxUint256);
    const uniswap = IUniswapV2Router__factory.connect(uniswapRouter, accounts[0]);
    await uniswap.addLiquidityETH(
      pika.address,
      ethers.utils.parseEther('30000000'),
      ethers.utils.parseEther('30000000'),
      ethers.utils.parseEther('30'),
      owner,
      unix2100,
      { value: ethers.utils.parseEther('30') }
    );
    const LiquidityFactory = (await ethers.getContractFactory('Liquidity')) as Liquidity__factory;
    liquidity = (await upgrades.deployProxy(LiquidityFactory, [pika.address, await pika.uniswapPair()])) as Liquidity;
    pair = IUniswapV2Pair__factory.connect(await pika.uniswapPair(), accounts[0]);
    await pair.transfer(accounts[1].address, await pair.balanceOf(owner));
  });

  describe('Setup tests', async () => {
    it('should set up contract correctly', async () => {
      expect(await liquidity.token()).to.equal(pika.address);
      expect(await liquidity.uniswapPair()).to.equal(await pika.uniswapPair());
      expect(await liquidity.lockPeriod()).to.equal(ethers.BigNumber.from('15724800'));
      expect(await pair.totalSupply()).to.equal(ethers.utils.parseEther('30000'));
    });
  });

  describe('Management tests', async () => {
    it('should only be callable by owner', async () => {
      await expect(liquidity.connect(accounts[1]).setLockPeriod('1')).to.be.revertedWith('Owned: not owner');
      await expect(liquidity.connect(accounts[1]).setVestingPeriod('1')).to.be.revertedWith('Owned: not owner');
    });

    it('should be able to update lock period', async () => {
      await expect(liquidity.setLockPeriod(lockPeriod.toString()))
        .to.emit(liquidity, 'LockPeriodUpdated')
        .withArgs('15724800', '10000');
    });
    it('should be able to update vesting period', async () => {
      await expect(liquidity.setVestingPeriod(vestingPeriod.toString()))
        .to.emit(liquidity, 'VestingPeriodUpdated')
        .withArgs('31449600', '20000');
    });
  });

  describe('Provide liquidity locked', async () => {
    it('should be able to provide liquidity when providing no ETH', async () => {
      await expect(liquidity.provideLiquidity(true)).to.be.revertedWith('Liquidity: No ETH provided');
    });
    it('should be able to provide liquidity if insufficient amount of tokens in contract', async () => {
      await expect(liquidity.provideLiquidity(true, { value: ethers.utils.parseEther('1') })).to.be.revertedWith(
        'Insufficient token amount in contract'
      );
    });
    it('should be able to provide liquidity', async () => {
      await pika.transfer(liquidity.address, ethers.utils.parseEther('1000000'));
      await expect(liquidity.provideLiquidity(true, { value: ethers.utils.parseEther('1') }))
        .to.emit(liquidity, 'ProvidedLiquidity')
        .withArgs(owner, true, '0', ethers.utils.parseEther('1000'));
    });
    it('should lock correct amount of LP tokens', async () => {
      expect(await liquidity.depositedBalance(owner, '0')).to.equal(ethers.utils.parseEther('1000'));
      expect(await liquidity.withdrawableBalance(owner, '0')).to.equal('0');
    });
    it('should update nonce correctly', async () => {
      expect(await liquidity.nonces(owner)).to.equal('1');
    });
    it('should use expected amount of tokens from contract', async () => {
      expect(await pika.balanceOf(liquidity.address)).to.equal('0');
    });
    it('should store deposit data correctly', async () => {
      const deposit = await liquidity.deposits(owner, '0');
      expect(deposit.balance).to.equal(ethers.utils.parseEther('1000'));
      expect(deposit.withdrawnBalance).to.equal('0');
      expect(deposit.locked).to.be.true;
    });
    it('should not be able to withdraw tokens', async () => {
      await expect(liquidity.withdraw('0')).to.be.revertedWith(
        'Liquidity: No unlocked tokens to withdraw for provided id'
      );
    });
  });

  describe('Provide liquidity vested', async () => {
    before(async () => {
      await pika.transfer(liquidity.address, ethers.utils.parseEther('1000000'));
      const deposit = await liquidity.deposits(owner, '0');
      await ethers.provider.send('evm_setNextBlockTimestamp', [deposit.timestamp + lockPeriod / 2]);
    });
    it('should be able to provide liquidity', async () => {
      await expect(liquidity.provideLiquidity(false, { value: ethers.utils.parseEther('1') }))
        .to.emit(liquidity, 'ProvidedLiquidity')
        .withArgs(owner, false, '1', ethers.utils.parseEther('1000'));
    });
    it('should lock correct amount of LP tokens', async () => {
      expect(await liquidity.depositedBalance(owner, '1')).to.equal(ethers.utils.parseEther('1000'));
      expect(await liquidity.withdrawableBalance(owner, '1')).to.equal('0');
    });
    it('should update nonce correctly', async () => {
      expect(await liquidity.nonces(owner)).to.equal('2');
    });
    it('should use expected amount of tokens from contract', async () => {
      expect(await pika.balanceOf(liquidity.address)).to.equal('0');
    });
    it('should store deposit data correctly', async () => {
      const deposit = await liquidity.deposits(owner, '1');
      expect(deposit.balance).to.equal(ethers.utils.parseEther('1000'));
      expect(deposit.withdrawnBalance).to.equal('0');
      expect(deposit.locked).to.be.false;
    });
  });
  describe('Withdraw liquidity locked', async () => {
    it('should not be able to withdraw locked token', async () => {
      const deposit = await liquidity.deposits(owner, '0');
      await ethers.provider.send('evm_setNextBlockTimestamp', [deposit.timestamp + lockPeriod - 1]);
      await expect(liquidity.withdraw('0')).to.be.revertedWith(
        'Liquidity: No unlocked tokens to withdraw for provided id'
      );
      expect(await liquidity.withdrawableBalance(owner, '0')).to.equal('0');
    });
    it('should be able to withdraw locked token', async () => {
      const deposit = await liquidity.deposits(owner, '0');
      await ethers.provider.send('evm_setNextBlockTimestamp', [deposit.timestamp + lockPeriod]);
      await ethers.provider.send('evm_mine', []);
      expect(await liquidity.withdrawableBalance(owner, '0')).to.equal(ethers.utils.parseEther('1000'));
      await expect(liquidity.withdraw('0'))
        .to.be.emit(liquidity, 'Withdraw')
        .withArgs(owner, true, '0', ethers.utils.parseEther('1000'));
      expect(await pair.balanceOf(owner)).to.equal(ethers.utils.parseEther('1000'));
    });
    it('should not be able to withdraw already withdrawn tokens', async () => {
      expect(await liquidity.withdrawableBalance(owner, '0')).to.equal('0');
      await expect(liquidity.withdraw('0')).to.be.revertedWith(
        'Liquidity: No unlocked tokens to withdraw for provided id'
      );
      const deposit = await liquidity.deposits(owner, '0');
      expect(deposit.withdrawnBalance).to.equal(ethers.utils.parseEther('1000'));
    });
    it('should not be able to withdraw non existent token', async () => {
      expect(await liquidity.depositedBalance(owner, '2')).to.equal(0);
      await expect(liquidity.withdraw('2')).to.be.revertedWith('Liquidity: No deposit found for provided id');
    });
  });
  describe('Withdraw liquidity vested', async () => {
    it('should be able to withdraw 30% of vested token', async () => {
      let deposit = await liquidity.deposits(owner, '1');
      expect(deposit.withdrawnBalance).to.equal('0');
      await ethers.provider.send('evm_setNextBlockTimestamp', [deposit.timestamp + (vestingPeriod * 3) / 10]);
      await expect(liquidity.withdraw('1'))
        .to.be.emit(liquidity, 'Withdraw')
        .withArgs(owner, false, '1', ethers.utils.parseEther('300'));
      deposit = await liquidity.deposits(owner, '1');
      expect(deposit.withdrawnBalance).to.equal(ethers.utils.parseEther('300'));
    });
    it('should show accurate withdrawable balance', async () => {
      const deposit = await liquidity.deposits(owner, '1');
      await ethers.provider.send('evm_setNextBlockTimestamp', [deposit.timestamp + (vestingPeriod * 7) / 10]);
      await ethers.provider.send('evm_mine', []);
      expect(await liquidity.withdrawableBalance(owner, '1')).to.equal(ethers.utils.parseEther('400'));
    });
    it('should be able to withdraw full amount after vesting period is over', async () => {
      let deposit = await liquidity.deposits(owner, '1');
      await ethers.provider.send('evm_setNextBlockTimestamp', [deposit.timestamp + vestingPeriod * 1.5]);
      await ethers.provider.send('evm_mine', []);
      expect(await liquidity.withdrawableBalance(owner, '1')).to.equal(ethers.utils.parseEther('700'));
      await expect(liquidity.withdraw('1'))
        .to.be.emit(liquidity, 'Withdraw')
        .withArgs(owner, false, '1', ethers.utils.parseEther('700'));
      deposit = await liquidity.deposits(owner, '1');
      expect(deposit.withdrawnBalance).to.equal(ethers.utils.parseEther('1000'));
      expect(await liquidity.withdrawableBalance(owner, '1')).to.equal('0');
    });
    it('should not be able to withdraw already fully withdrawn tokens', async () => {
      expect(await liquidity.withdrawableBalance(owner, '1')).to.equal('0');
      await expect(liquidity.withdraw('1')).to.be.revertedWith(
        'Liquidity: No unlocked tokens to withdraw for provided id'
      );
    });
    it('should be able to withdraw all vested tokens at once', async () => {
      await pika.transfer(liquidity.address, ethers.utils.parseEther('1000000'));
      await expect(liquidity.provideLiquidity(false, { value: ethers.utils.parseEther('1') }))
        .to.emit(liquidity, 'ProvidedLiquidity')
        .withArgs(owner, false, '2', ethers.utils.parseEther('1000'));
      let deposit = await liquidity.deposits(owner, '2');
      await ethers.provider.send('evm_setNextBlockTimestamp', [deposit.timestamp + vestingPeriod * 2]);
      await ethers.provider.send('evm_mine', []);
      expect(await liquidity.withdrawableBalance(owner, '2')).to.equal(ethers.utils.parseEther('1000'));
      await expect(liquidity.withdraw('2'))
        .to.be.emit(liquidity, 'Withdraw')
        .withArgs(owner, false, '2', ethers.utils.parseEther('1000'));
      deposit = await liquidity.deposits(owner, '2');
      expect(deposit.withdrawnBalance).to.equal(ethers.utils.parseEther('1000'));
      expect(await liquidity.withdrawableBalance(owner, '2')).to.equal('0');
    });
  });
});
