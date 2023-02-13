import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect, use } from 'chai';
import { MULTISIG_TTL_DEFAULT, ZERO_ADDRESS } from './data/constants';
import chaiAsPromised from 'chai-as-promised';
import {
    expectConfirmTransaction,
    expectRevokeConfirmation,
    expectSubmitTransaction,
    expectExecuteTransaction,
    setQuorumEncode,
    stepInit,
} from '../steps/multisig';
import { BigNumber } from 'ethers';
import {
    deployMultisig,
    deployMultisigFixtureManyAdmins,
    deployMultisigFixtureOneAdmin,
    deployMultisigOneAdminWithInit,
} from '../steps/multisig.fixtures';
import { ethers } from 'hardhat';
import { mine } from '@nomicfoundation/hardhat-network-helpers';

use(chaiAsPromised);

describe('Multisig', () => {
    describe('smoke tests', () => {
        it('simple positive', async () => {
            const { multisig, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await stepInit(multisig, [other.address], 1, MULTISIG_TTL_DEFAULT);
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                other,
                setQuorumEncode(multisig),
                BigNumber.from(0n),
                startTxId
            );
            await expectConfirmTransaction(multisig, other, startTxId);
            await expectRevokeConfirmation(multisig, other, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            await expectExecuteTransaction(multisig, other, startTxId);
        });
    });

    describe('should be initialized', () => {
        it('should throw when empty admins array', async () => {
            const { multisig } = await loadFixture(deployMultisigFixtureOneAdmin);
            return expect(
                multisig.init([''], 1, MULTISIG_TTL_DEFAULT)
            ).be.rejectedWith('resolver or addr is not configured for ENS name');
        });

        it('should throw when quorum == 0', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            return expect(
                multisig.init([admin.address], 0, MULTISIG_TTL_DEFAULT)
            ).be.rejectedWith('invalid quorum');
        });

        it('should throw when quorum more than admins length', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            return expect(
                multisig.init([admin.address, other.address], 3, MULTISIG_TTL_DEFAULT)
            ).be.rejectedWith('invalid quorum');
        });

        it('should throw when admin array contains zero address', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            return expect(
                multisig.init([admin.address, ZERO_ADDRESS], 1, MULTISIG_TTL_DEFAULT)
            ).be.rejectedWith('zero address');
        });

        it('should throw when admin array contains duplicates', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );

            return expect(
                multisig.init(
                    [admin.address, other.address, admin.address],
                    2,
                    MULTISIG_TTL_DEFAULT
                )
            ).be.rejectedWith('admin is duplicated');
        });

        it('should be started correctly', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await multisig.init([admin.address], 1, MULTISIG_TTL_DEFAULT);
            expect(await multisig.quorum()).to.be.equal(1);
            expect(await multisig.admins(0)).to.be.equal(admin.address);
            expect(await multisig.isAdmin(admin.address)).is.true;
            expect(await multisig.isAdmin(other.address)).is.false;
        });
    });

    describe('should be ownable', () => {
        it('should throw when no-admin call submitTransaction', async () => {
            const { multisig, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await expect(
                multisig
                    .connect(other)
                    .submitTransaction(other.address, 0, setQuorumEncode(multisig))
            ).to.be.revertedWith('only admin');
        });

        it('should throw when no-admin call confirmTransaction', async () => {
            const { multisig, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await expect(
                multisig.connect(other).confirmTransaction(0)
            ).to.be.revertedWith('only admin');
        });

        it('should throw when no-admin call revokeConfirmation', async () => {
            const { multisig, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await expect(
                multisig.connect(other).revokeConfirmation(0)
            ).to.be.revertedWith('only admin');
        });
    });

    describe('should be self-callable', () => {
        it('should throw when no-self call addAdmin', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await expect(
                multisig.connect(admin).addAdmin(other.address)
            ).to.be.revertedWith('only self');
        });

        it('should throw when no-self call removeAdmin', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await expect(
                multisig.connect(admin).removeAdmin(other.address)
            ).to.be.revertedWith('only self');
        });

        it('should throw when no-self call setQuorum', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await expect(multisig.connect(admin).setQuorum(1)).to.be.revertedWith(
                'only self'
            );
        });
    });

    describe('executeTransaction functional tests', () => {
        it('can executeTransaction', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigOneAdminWithInit
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            const beforeTx = await multisig.txs(startTxId);
            expect(beforeTx.isExecuted).is.false;
            await expectExecuteTransaction(multisig, admin, startTxId);
            const afterTx = await multisig.txs(startTxId);
            expect(afterTx.isExecuted).is.true;
        });

        it('should throw when transaction re-execute', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigOneAdminWithInit
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );

            await expectConfirmTransaction(multisig, admin, startTxId);
            const beforeTx = await multisig.txs(startTxId);
            expect(beforeTx.isExecuted).is.false;
            await expectExecuteTransaction(multisig, admin, startTxId);
            const afterTx = await multisig.txs(startTxId);
            expect(afterTx.isExecuted).is.true;
            await expect(
                multisig.connect(admin).executeTransaction(startTxId)
            ).to.be.revertedWith('tx is executed');
            const checkTx = await multisig.txs(startTxId);
            expect(checkTx.isExecuted).is.true;
        });

        it('should throw when transaction not confirmed', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigOneAdminWithInit
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            const beforeTx = await multisig.txs(startTxId);
            expect(beforeTx.isExecuted).is.false;
            await expect(
                multisig.connect(admin).executeTransaction(startTxId)
            ).to.be.revertedWith('is not confirmed');
            const afterTx = await multisig.txs(startTxId);
            expect(afterTx.isExecuted).is.false;
        });

        it('should throw when calldata is wrong', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigOneAdminWithInit
            );
            const startTxId = await multisig.txsCount();
            await expect(
                await multisig
                    .connect(admin)
                    .submitTransaction(
                        multisig.address,
                        0,
                        Buffer.from(multisig.interface.encodeFunctionData('setQuorum', [1]))
                    )
            )
                .to.emit(multisig, 'Submission')
                .withArgs(startTxId);
            await expectConfirmTransaction(multisig, admin, startTxId);

            const beforeTx = await multisig.txs(startTxId);
            expect(beforeTx.isExecuted).is.false;

            await expect(
                expectExecuteTransaction(multisig, admin, startTxId)
            ).to.be.revertedWith('no error');
            const afterTx = await multisig.txs(startTxId);
            expect(afterTx.isExecuted).is.false;
        });

        it('can execute transaction when block height is equals TTL', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await multisig.init([admin.address], 1, 2); // because on execute block number added on 1
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            const beforeTx = await multisig.txs(startTxId);
            expect(beforeTx.isExecuted).is.false;
            await expectExecuteTransaction(multisig, admin, startTxId);
            const afterTx = await multisig.txs(startTxId);
            expect(afterTx.isExecuted).is.true;
        });

        it('should throw when block\'s height more than TTL', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await multisig.init([admin.address], 1, 1);
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await mine(3);
            await expect(
                expectExecuteTransaction(multisig, admin, startTxId)
            ).to.be.revertedWith('tx too old');
        });
    });

    describe('isConfirmed functional tests', () => {
        it('should be true when quorum is 1', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await multisig.init([admin.address], 1, MULTISIG_TTL_DEFAULT);
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0n),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(await multisig.connect(admin).isConfirmed(startTxId)).is.true;
        });

        it('should be false when txId incorrect', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureOneAdmin
            );
            await multisig.init(
                [admin.address, other.address],
                2,
                MULTISIG_TTL_DEFAULT
            );
            expect(await multisig.connect(admin).isConfirmed(31337n)).is.false;
        });

        it('can check isConfirmed', async () => {
            const { multisig, admin, other } = await loadFixture(deployMultisig);
            await multisig.init(
                [admin.address, other.address],
                2,
                MULTISIG_TTL_DEFAULT
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0n),
                startTxId
            );
            expect(await multisig.connect(admin).isConfirmed(startTxId)).is.false;
        });

        it('check isConfirmed by no-admin', async () => {
            const { multisig, admin, other, third } = await loadFixture(
                deployMultisig
            );
            await multisig.init(
                [admin.address, other.address],
                2,
                MULTISIG_TTL_DEFAULT
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0n),
                startTxId
            );
            expect(await multisig.connect(third).isConfirmed(startTxId)).is.false;
        });

        it('should be false when 1 confirmation with 2 quorum', async () => {
            const { multisig, admin, other } = await loadFixture(deployMultisig);
            await multisig.init(
                [admin.address, other.address],
                2,
                MULTISIG_TTL_DEFAULT
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0n),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.true;
            expect(await multisig.connect(admin).isConfirmed(startTxId)).is.false;
        });
    });

    describe('addAdmin functional tests', () => {
        it('can add new admin', async () => {
            const { multisig, admin, other, third } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            expect(await multisig.isAdmin(other.address)).is.true;
            expect(await multisig.isAdmin(third.address)).is.false;

            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                multisig.interface.encodeFunctionData('addAdmin', [third.address]),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            expect(await multisig.isAdmin(third.address)).is.false;
            await expectExecuteTransaction(multisig, admin, startTxId);
            expect(await multisig.isAdmin(third.address)).is.true;
        });

        it('should throw when try to add duplicate admin', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            expect(await multisig.isAdmin(other.address)).is.true;
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                multisig.interface.encodeFunctionData('addAdmin', [other.address]),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            await expect(
                expectExecuteTransaction(multisig, admin, startTxId)
            ).to.be.revertedWith('only not admin');
        });

        it('should throw when admin with zero address', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            expect(await multisig.isAdmin(other.address)).is.true;
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                multisig.interface.encodeFunctionData('addAdmin', [ZERO_ADDRESS]),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            await expect(
                expectExecuteTransaction(multisig, admin, startTxId)
            ).to.be.revertedWith('zero address');
        });
    });

    describe('removeAdmin functional tests', () => {
        it('can remove admin', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            expect(await multisig.isAdmin(other.address)).is.true;
            expect(await multisig.quorum()).to.be.equal(2);
            await expectSubmitTransaction(
                multisig,
                admin,
                multisig.interface.encodeFunctionData('removeAdmin', [admin.address]),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            await expectExecuteTransaction(multisig, other, startTxId);
            expect(await multisig.isAdmin(admin.address)).is.false;
            expect(await multisig.isAdmin(other.address)).is.true;
            expect(await multisig.quorum()).to.be.equal(1);
        });

        it('admin can be removed only by other admin', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            expect(await multisig.isAdmin(other.address)).is.true;
            await expectSubmitTransaction(
                multisig,
                admin,
                multisig.interface.encodeFunctionData('removeAdmin', [other.address]),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            await expectExecuteTransaction(multisig, other, startTxId);
            expect(await multisig.isAdmin(admin.address)).is.true;
            expect(await multisig.isAdmin(other.address)).is.false;
        });

        it('can\'t remove last admin', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            expect(await multisig.isAdmin(other.address)).is.true;
            let txId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                multisig.interface.encodeFunctionData('removeAdmin', [other.address]),
                BigNumber.from(0),
                txId
            );
            await expectConfirmTransaction(multisig, admin, txId);
            await expectConfirmTransaction(multisig, other, txId);
            await expect(multisig.connect(admin).executeTransaction(txId)).to.be.emit(
                multisig,
                'Execution'
            );
            expect(await multisig.isAdmin(admin.address)).is.true;
            expect(await multisig.isAdmin(other.address)).is.false;
            expect(await multisig.quorum()).to.be.equal(1);
            txId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                multisig.interface.encodeFunctionData('removeAdmin', [admin.address]),
                BigNumber.from(0),
                txId
            );
            await expectConfirmTransaction(multisig, admin, txId);
            await expect(
                multisig.connect(admin).executeTransaction(txId)
            ).to.be.rejectedWith('invalid quorum');
            expect(await multisig.isAdmin(admin.address)).is.true;
            expect(await multisig.quorum()).to.be.equal(1);
        });

        it('can remove admin without quorum changing', async () => {
            const { multisig, admin, other, third } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            let startTxId = await multisig.txsCount();
            expect(await multisig.isAdmin(other.address)).is.true;
            expect(await multisig.isAdmin(admin.address)).is.true;
            expect(await multisig.isAdmin(third.address)).is.false;
            expect(await multisig.quorum()).to.be.equal(2);
            startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                multisig.interface.encodeFunctionData('addAdmin', [third.address]),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            await expectExecuteTransaction(multisig, admin, startTxId);
            expect(await multisig.isAdmin(third.address)).is.true;
            expect(await multisig.quorum()).to.be.equal(2);
            startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                multisig.interface.encodeFunctionData('removeAdmin', [third.address]),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            await expectExecuteTransaction(multisig, other, startTxId);
            expect(await multisig.isAdmin(admin.address)).is.true;
            expect(await multisig.isAdmin(other.address)).is.true;
            expect(await multisig.isAdmin(third.address)).is.false;
            expect(await multisig.quorum()).to.be.equal(2);
        });
    });

    describe('setQuorum functional tests', () => {
        it('can update quorum value', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig, 1),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            await expectExecuteTransaction(multisig, other, startTxId);
            expect(await multisig.quorum()).to.be.equal(1);
        });

        it('should throw when set quorum = 0', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig, 0),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            await expectConfirmTransaction(multisig, other, startTxId);
            await expect(
                expectExecuteTransaction(multisig, other, startTxId)
            ).to.be.revertedWith('invalid quorum');
            expect(await multisig.quorum()).to.be.equal(2);
        });
    });

    describe('submitTransaction functional tests', () => {
        it('should throw when address is zero', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            await expect(
                multisig
                    .connect(admin)
                    .submitTransaction(ZERO_ADDRESS, 0, setQuorumEncode(multisig))
            ).to.be.revertedWith('zero address');
        });

        it('submitTransaction works with various addresses:', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expect(
                await multisig
                    .connect(admin)
                    .submitTransaction(other.address, 0, setQuorumEncode(multisig))
            )
                .to.emit(multisig, 'Submission')
                .withArgs(startTxId);
            expect(await multisig.txsCount()).to.be.greaterThan(startTxId);
        });

        it('submitTransaction works with value in BigNumber diapason', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(1000000000000000000n),
                startTxId
            );
            expect(await multisig.txsCount()).to.be.greaterThan(startTxId);
        });

        it('submitTransaction works with various calldata', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                ZERO_ADDRESS,
                BigNumber.from(0),
                startTxId
            );
            expect(await multisig.txsCount()).to.be.greaterThan(startTxId);
        });
    });

    describe('confirmTransaction functional tests', () => {
        it('admin can confirm transaction', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );

            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.true;
        });

        // No repeat! Another case =)
        it('should throw wneh no-admin try to confirm transaction', async () => {
            const { multisig, admin, third } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            await expect(
                multisig.connect(third).confirmTransaction(startTxId)
            ).to.be.revertedWith('only admin');
        });

        it('should throw when try to confirm incorrect txId', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            await expect(
                multisig.connect(admin).confirmTransaction(31337n)
            ).to.be.revertedWith('txId is incorrect');
            expect(await multisig.confirms(startTxId, admin.address)).is.false;
        });

        it('should throw wneh try to re-confirm transaction', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.true;
            await expect(
                multisig.connect(admin).confirmTransaction(startTxId)
            ).to.be.revertedWith('tx is confirmed');
            expect(await multisig.confirms(startTxId, admin.address)).is.true;
        });
    });

    describe('revokeConfirmation functional tests', () => {
        it('can revoke confirmation', async function() {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            expect(await multisig.confirms(startTxId, admin.address)).is.false;

            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.true;

            await expectRevokeConfirmation(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.false;
        });

        it('revoke confirmation in multisig', async () => {
            const { multisig, admin, other } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            expect(await multisig.confirms(startTxId, admin.address)).is.false;
            expect(await multisig.confirms(startTxId, other.address)).is.false;

            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.true;
            expect(await multisig.confirms(startTxId, other.address)).is.false;

            await expectConfirmTransaction(multisig, other, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.true;
            expect(await multisig.confirms(startTxId, other.address)).is.true;

            await expectRevokeConfirmation(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.false;
            expect(await multisig.confirms(startTxId, other.address)).is.true;
        });

        it('should throw when revoked with incorrect txId', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            expect(await multisig.confirms(startTxId, admin.address)).is.false;
            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.true;

            await expect(
                multisig.connect(admin).revokeConfirmation(31337n)
            ).to.revertedWith('tx is not confirmed');
            expect(await multisig.confirms(startTxId, admin.address)).is.true;
        });

        it('should throw on confirmation re-revoke', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            expect(await multisig.confirms(startTxId, admin.address)).is.false;

            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.true;

            await expectRevokeConfirmation(multisig, admin, startTxId);
            expect(await multisig.confirms(startTxId, admin.address)).is.false;

            await expect(
                multisig.connect(admin).revokeConfirmation(startTxId)
            ).to.revertedWith('tx is not confirmed');
            expect(await multisig.confirms(startTxId, admin.address)).is.false;
        });

        it('can many times confirm and revoke transaction', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            expect(await multisig.confirms(startTxId, admin.address)).is.false;

            for (let i = 0; i < 32; i++) {
                await expectConfirmTransaction(multisig, admin, startTxId);
                expect(await multisig.confirms(startTxId, admin.address)).is.true;

                await expectRevokeConfirmation(multisig, admin, startTxId);
                expect(await multisig.confirms(startTxId, admin.address)).is.false;
            }
        });
    });

    describe('getConfirmationsCount functional tests', () => {
        it('can get confirmations count', async function() {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            expect(
                await multisig.connect(admin).getConfirmationsCount(startTxId)
            ).to.be.equal(0);
            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(
                await multisig.connect(admin).getConfirmationsCount(startTxId)
            ).to.be.equal(1);
        });

        it('no-admin also can get confirmations count', async () => {
            const { multisig, admin, third } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            expect(
                await multisig.connect(third).getConfirmationsCount(startTxId)
            ).to.be.equal(1);
        });

        it('should get 0 when txId incorrect', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            expect(
                await multisig.connect(admin).getConfirmationsCount(31337n)
            ).to.be.equal(0);
        });
    });

    describe('getConfirmations functional tests', () => {
        it('can get confirmations', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0n),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            const confirmations = await multisig
                .connect(admin)
                .getConfirmations(startTxId);
            expect(confirmations).to.be.deep.equal([admin.address]);
        });

        it('no-admin also can get confirmations', async () => {
            const { multisig, admin, third } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0n),
                startTxId
            );
            await expectConfirmTransaction(multisig, admin, startTxId);
            const confirmations = await multisig
                .connect(third)
                .getConfirmations(startTxId);
            expect(confirmations).to.be.deep.equal([admin.address]);
        });

        it('should get empty confirmations', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const startTxId = await multisig.txsCount();
            await expectSubmitTransaction(
                multisig,
                admin,
                setQuorumEncode(multisig),
                BigNumber.from(0n),
                startTxId
            );
            const confirmations = await multisig
                .connect(admin)
                .getConfirmations(startTxId);
            expect(confirmations).to.be.deep.equal([]);
        });

        it('should get empty confirmations with incorrect txId', async () => {
            const { multisig, admin } = await loadFixture(
                deployMultisigFixtureManyAdmins
            );
            const confirmations = await multisig
                .connect(admin)
                .getConfirmations(31337n);
            expect(confirmations).to.be.deep.equal([]);
        });
    });

    /**
   * TODO:  8) [???] check possible empty admins idx where isAdmin = true
   */
});
