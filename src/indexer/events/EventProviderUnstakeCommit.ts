import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*

no good examples recently
LavaBlockDebugDumpEvents txs event 1050816 lava_provider_unstake_commit {
  type: "lava_provider_unstake_commit",
  attributes: [
    {
      key: "address",
      value: "",
    }, {
      key: "chainID",
      value: "",
    }, {
      key: "geolocation",
      value: "0",
    }, {
      key: "moniker",
      value: "",
    }, {
      key: "stake",
      value: "<nil>",
    }
  ],
}

LavaBlockDebugDumpEvents txs event 1009118 lava_provider_unstake_commit {
  type: "lava_provider_unstake_commit",
  attributes: [
    {
      key: "address",
      value: "lava@1l0gcpxw6zrhsxjv68rzvscvcx4p9f07y7974r5",
    }, {
      key: "chainID",
      value: "FTM250",
    }, {
      key: "geolocation",
      value: "1",
    }, {
      key: "moniker",
      value: "stg-lava-1-provider1-FTM250",
    }, {
      key: "stake",
      value: "0",
    }
  ],
}

462618 {
  type: 'lava_provider_unstake_commit',
  attributes: [
    { key: 'stake', value: '50000000000' },
    {
      key: 'address',
      value: 'lava@1m5p9cc4lp6jxdsk3pdf56tek2muzu3sm4rhp5f'
    },
    { key: 'chainID', value: 'COS5' },
    { key: 'geolocation', value: '2' },
    { key: 'moniker', value: 'Iryna' }
  ]
}
*/

export const ParseEventProviderUnstakeCommit = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  const evtEvent: schema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: schema.LavaProviderEventType.ProviderUnstakeCommit,
    consumer: null,
  }

  if (!EventProcessAttributes("ParseEventProviderUnstakeCommit", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'geolocation':
          evtEvent.i1 = EventParseInt(value)
          break
        case 'moniker':
          evtEvent.t1 = value;
          break
        case 'stake':
          evtEvent.b1 = EventParseInt(value)
          break
        case 'address':
          evtEvent.provider = EventParseProviderAddress(value);
          break
        case 'chainID':
          evtEvent.t2 = value;
          break
      }
    },
    // verifyFunction: () => !!evtEvent.provider
    verifyFunction: null
  })) return;

  if (!evtEvent.provider) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)
}