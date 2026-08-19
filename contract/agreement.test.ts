import { describe, expect, test } from 'vitest';
import { Contract, ledger } from './build/contract/index.js';
import {
  createCircuitContext,
  createConstructorContext,
  dummyContractAddress,
} from '@midnight-ntwrk/compact-runtime';

const coinPublicKey = '00'.repeat(32);

const newBytes = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);

interface Signer {
  contract: Contract;
  secretKey: Uint8Array;
}

const makeSigner = (fill: number): Signer => ({
  secretKey: newBytes(fill),
  contract: new Contract({
    mySecretKey: () => [undefined, newBytes(fill)],
  }),
});

const publicKeyOf = (signer: Signer): Uint8Array =>
  (signer.contract as unknown as { _publicKey_0: (sk: Uint8Array) => Uint8Array })._publicKey_0(
    signer.secretKey,
  );

describe('Agreement contract logic', () => {
  test('createAgreement then signAgreement transitions status PENDING -> SIGNED', () => {
    const partyA = makeSigner(0xaa);
    const partyB = makeSigner(0xbb);
    const partyBId = publicKeyOf(partyB);
    const termsFingerprint = newBytes(0xcc);

    const initial = partyA.contract.initialState(
      createConstructorContext(undefined, coinPublicKey),
    );

    let context = createCircuitContext(
      dummyContractAddress(),
      coinPublicKey,
      initial.currentContractState.data,
      undefined,
    );

    const created = partyA.contract.circuits.createAgreement(context, partyBId, termsFingerprint);
    context = created.context;

    const ledgerAfterCreate = ledger(context.currentQueryContext.state);
    expect(ledgerAfterCreate.nextId).toBe(BigInt(1));
    expect(ledgerAfterCreate.agreements.size()).toBe(BigInt(1));

    const [createId, createAg] = [...ledgerAfterCreate.agreements][0];
    expect(createId).toBe(BigInt(0));
    expect(createAg.status).toBe(0);
    expect(Buffer.from(createAg.partyA).equals(publicKeyOf(partyA))).toBe(true);
    expect(Buffer.from(createAg.partyBId).equals(partyBId)).toBe(true);
    expect(Buffer.from(createAg.termsFingerprint).equals(termsFingerprint)).toBe(true);

    const signed = partyB.contract.circuits.signAgreement(context, createId);
    context = signed.context;

    const signedAg = ledger(context.currentQueryContext.state).agreements.lookup(createId);
    expect(signedAg.status).toBe(1);
    expect(partyB.contract.circuits.isSigned(context, createId).result).toEqual([true]);
  });

  test('an already-signed agreement cannot be signed again', () => {
    const partyA = makeSigner(0xaa);
    const partyB = makeSigner(0xbb);
    const partyBId = publicKeyOf(partyB);

    const initial = partyA.contract.initialState(
      createConstructorContext(undefined, coinPublicKey),
    );
    let context = createCircuitContext(
      dummyContractAddress(),
      coinPublicKey,
      initial.currentContractState.data,
      undefined,
    );

    const created = partyA.contract.circuits.createAgreement(context, partyBId, newBytes(0xcc));
    context = created.context;
    const createId = [...ledger(context.currentQueryContext.state).agreements][0][0];

    context = partyB.contract.circuits.signAgreement(context, createId).context;
    expect(() => partyB.contract.circuits.signAgreement(context, createId)).toThrow(
      'agreement is already signed',
    );
  });

  test('an unauthorized signer is rejected', () => {
    const partyA = makeSigner(0xaa);
    const partyB = makeSigner(0xbb);
    const intruder = makeSigner(0xcc);
    const partyBId = publicKeyOf(partyB);

    const initial = partyA.contract.initialState(
      createConstructorContext(undefined, coinPublicKey),
    );
    let context = createCircuitContext(
      dummyContractAddress(),
      coinPublicKey,
      initial.currentContractState.data,
      undefined,
    );

    const created = partyA.contract.circuits.createAgreement(context, partyBId, newBytes(0xdd));
    context = created.context;
    const createId = [...ledger(context.currentQueryContext.state).agreements][0][0];

    expect(() => intruder.contract.circuits.signAgreement(context, createId)).toThrow(
      'only Party B can sign this agreement',
    );
  });
});