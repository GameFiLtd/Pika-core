require('dotenv').config();
import { BigNumber } from '@ethersproject/bignumber';
import { ContractTransaction } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, network, upgrades } from 'hardhat';
import {
  IERC20,
  IERC20__factory,
  IUniswapV2Router,
  IUniswapV2Router__factory,
  Liquidity,
  Metra,
  Pika,
  Pika__factory,
} from '../typechain';

describe('Metra', () => {
  let metra: Metra;
  let pika: Pika;
  let uniswap: IUniswapV2Router;
  let accounts: SignerWithAddress[];
  let uniswapRouter: string;
  const unix2100 = '4102441200';
  let owner: string;
  let domain: {
    name: string;
    version: string;
    chainId: string;
    verifyingContract: string;
  };

  before(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0].address;
    const factory = await ethers.getContractFactory('Metra');
    metra = (await upgrades.deployProxy(factory, [
      '0',
      ethers.utils.parseEther('50000000000000'),
      accounts[1].address,
      'METRA',
      'METRA',
      '1000',
    ])) as Metra;
    uniswapRouter = await metra.router();
    await metra.setFeesEnabled(true);
    await metra.setSwapEnabled(true);
    await metra.approve(uniswapRouter, ethers.constants.MaxUint256);
    uniswap = IUniswapV2Router__factory.connect(uniswapRouter, accounts[0]);
    await uniswap.addLiquidityETH(
      metra.address,
      ethers.utils.parseEther('10000000'),
      ethers.utils.parseEther('10000000'),
      ethers.utils.parseEther('20'),
      owner,
      unix2100,
      { value: ethers.utils.parseEther('20') }
    );
    pika = await Pika__factory.connect('0x60F5672A271C7E39E787427A18353ba59A4A3578', accounts[0]);
    domain = {
      name: 'PIKA',
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId.toString(),
      verifyingContract: pika.address,
    };
  });

  describe('Uniswap tests & transfer tests', async () => {
    let weth: IERC20;

    before(async () => {
      weth = IERC20__factory.connect(await metra.WETH(), accounts[0]);
      await metra.setExcludeFromFee(owner, false);
    });

    it('should not take a fee on wallet to wallet transfer', async () => {
      const tx = metra.transfer(accounts[1].address, ethers.utils.parseEther('1000000'));
      await expect(tx)
        .to.emit(metra, 'Transfer')
        .withArgs(owner, accounts[1].address, ethers.utils.parseEther('1000000'));
      await expect(tx).to.not.emit(weth, 'Transfer');
    });

    describe('should take fee and autoswap on any interaction with uniswap', async () => {
      let balance1: BigNumber;
      let balance2: BigNumber;
      const amount = ethers.utils.parseEther('1000');
      const fee = amount.div(10);
      const burn = amount.div(400);
      let tx: Promise<ContractTransaction>;

      before(async () => {
        await metra.setStaking(accounts[2].address, '4000');
        balance1 = await metra.provider.getBalance(accounts[1].address);
        balance2 = await metra.provider.getBalance(accounts[2].address);
        tx = uniswap.swapExactTokensForETHSupportingFeeOnTransferTokens(
          amount,
          '0',
          [metra.address, weth.address],
          accounts[0].address,
          unix2100
        );
      });

      it('should transfer amount minus fee minus burn to uniswap', async () => {
        await expect(tx)
          .to.emit(metra, 'Transfer')
          .withArgs(owner, await metra.uniswapPair(), amount.sub(fee).sub(burn));
      });
      it('should transfer fee to uniswap', async () => {
        await expect(tx)
          .to.emit(metra, 'Transfer')
          .withArgs(metra.address, await metra.uniswapPair(), fee);
      });
      it('should burn', async () => {
        await expect(tx).to.emit(metra, 'Transfer').withArgs(owner, ethers.constants.AddressZero, burn);
      });
      it('should pay out ETH rewards to beneficiary', async () => {
        expect((await metra.provider.getBalance(accounts[1].address)).gt(balance1)).to.be.true;
      });
      it('should pay out ETH rewards to staking', async () => {
        expect((await metra.provider.getBalance(accounts[2].address)).gt(balance2)).to.be.true;
      });
    });
  });

  describe('Evolution', async () => {
    const staking = '0xd7FAac163c38cE303459089153F9C6f29b17f0BC';
    let liquidity: Liquidity;

    before(async () => {
      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [staking],
      });
      const pikaWallet = await ethers.getSigner(staking);
      await pika.connect(pikaWallet).transfer(owner, ethers.utils.parseEther('1000000000'));
      await network.provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [staking],
      });
      const liquidityFactory = await ethers.getContractFactory('Liquidity');
      liquidity = (await upgrades.deployProxy(liquidityFactory, [
        metra.address,
        await metra.uniswapPair(),
      ])) as Liquidity;
      await metra.setLiquidity(liquidity.address, '500');
    });

    describe('should be able to evolve', async () => {
      let tx: Promise<ContractTransaction>;
      const amount = ethers.utils.parseEther('100000000');
      before(async () => {
        await pika.approve(metra.address, amount);
        tx = metra.evolve(amount);
      });

      it('should transfer tokens to metra contract', async () => {
        await expect(tx).to.emit(pika, 'Transfer').withArgs(owner, metra.address, amount);
      });
      it('should burn tokens', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(metra.address, ethers.constants.AddressZero, amount.mul(65).div(100));
      });
      it('should transfer reward pool tokens', async () => {
        await expect(tx)
          .to.emit(pika, 'Transfer')
          .withArgs(metra.address, '0xd657d402e12cF2619d40b1B5069818B2989f17B4', amount.mul(3).div(10));
      });
      it('should transfer to staking', async () => {
        await expect(tx).to.emit(pika, 'Transfer').withArgs(metra.address, staking, amount.mul(5).div(100));
      });
      it('should mint to liquidity', async () => {
        await expect(tx)
          .to.emit(metra, 'Transfer')
          .withArgs(ethers.constants.AddressZero, liquidity.address, amount.mul(5).div(100).div(10000));
      });
      it('should mint metra tokens', async () => {
        await expect(tx).to.emit(metra, 'Transfer').withArgs(ethers.constants.AddressZero, owner, amount.div(10000));
      });
      it('should emit evolved event', async () => {
        await expect(tx).to.emit(metra, 'Evolved').withArgs(owner, amount);
      });
      it('should not hold any tokens after evolution', async () => {
        expect(await pika.balanceOf(metra.address)).to.eq('0');
      });
    });

    describe('evolution lock', async () => {
      it('should not be able to evolve more tokens when evolution locked', async () => {
        await expect(metra.evolve(ethers.utils.parseEther('1'))).to.be.revertedWith('EVOLUTION_LOCK');
      });
      it('should not be able to transfer tokens when evolution locked', async () => {
        await expect(metra.transfer(accounts[1].address, ethers.utils.parseEther('1'))).to.be.revertedWith(
          'EVOLUTION_LOCK'
        );
      });
      it('should lift evolution lock after 1 day', async () => {
        await network.provider.send('evm_increaseTime', [86400]);
        await pika.approve(metra.address, ethers.utils.parseEther('1'));
        await expect(metra.evolve(ethers.utils.parseEther('1'))).to.emit(metra, 'Evolved');
      });
      it('excluded from fees should be able to evolve any time', async () => {
        await pika.approve(metra.address, ethers.utils.parseEther('1'));
        await expect(metra.evolve(ethers.utils.parseEther('1'))).to.be.revertedWith('EVOLUTION_LOCK');
        await metra.setExcludeFromFee(owner, true);
        await expect(metra.evolve(ethers.utils.parseEther('1'))).to.emit(metra, 'Evolved');
      });
    });
  });

  describe('Evolve with permit', async () => {
    let signature: string;
    before(async () => {
      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      };
      const values = {
        owner: accounts[0].address,
        spender: metra.address,
        value: ethers.constants.MaxUint256,
        nonce: await pika.nonces(accounts[0].address),
        deadline: unix2100,
      };
      signature = await accounts[0]._signTypedData(domain, types, values);
    });

    it('should fail if invalid signature length provided', async () => {
      await expect(metra.evolveWithPermit('1', unix2100, [])).to.be.reverted;
    });

    it('should be able to evolve with permit', async () => {
      await expect(metra.evolve(ethers.utils.parseEther('1'))).to.be.revertedWith(
        'ERC20: transfer amount exceeds allowance'
      );
      await expect(metra.evolveWithPermit(ethers.utils.parseEther('1'), unix2100, signature)).to.emit(metra, 'Evolved');
    });
  });
});
