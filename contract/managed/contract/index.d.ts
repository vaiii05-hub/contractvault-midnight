import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  mySecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createAgreement(context: __compactRuntime.CircuitContext<PS>,
                  partyBId_0: Uint8Array,
                  termsFingerprint_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  signAgreement(context: __compactRuntime.CircuitContext<PS>, id_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  isSigned(context: __compactRuntime.CircuitContext<PS>, id_0: bigint): __compactRuntime.CircuitResults<PS, [boolean]>;
}

export type ProvableCircuits<PS> = {
  createAgreement(context: __compactRuntime.CircuitContext<PS>,
                  partyBId_0: Uint8Array,
                  termsFingerprint_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  signAgreement(context: __compactRuntime.CircuitContext<PS>, id_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  isSigned(context: __compactRuntime.CircuitContext<PS>, id_0: bigint): __compactRuntime.CircuitResults<PS, [boolean]>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  createAgreement(context: __compactRuntime.CircuitContext<PS>,
                  partyBId_0: Uint8Array,
                  termsFingerprint_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  signAgreement(context: __compactRuntime.CircuitContext<PS>, id_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  isSigned(context: __compactRuntime.CircuitContext<PS>, id_0: bigint): __compactRuntime.CircuitResults<PS, [boolean]>;
}

export type Ledger = {
  agreements: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): { partyA: Uint8Array,
                             partyBId: Uint8Array,
                             termsFingerprint: Uint8Array,
                             status: number
                           };
    [Symbol.iterator](): Iterator<[bigint, { partyA: Uint8Array,
  partyBId: Uint8Array,
  termsFingerprint: Uint8Array,
  status: number
}]>
  };
  readonly nextId: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
