import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { GetOrSetProvider, SetTx } from "../blockchainEntities/blockchainEntitiesGettersAndSetters";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt, EventParseAlphaNumericString } from "../eventUtils";

/*
EventDebug event 1149138 Source: Tx events type: lava_provider_latest_block_report 
 {
  type: "lava_provider_latest_block_report",
  attributes: [
    {
      key: "AXELAR",
      value: "12464562",
    }, {
      key: "AXELART",
      value: "13179167",
    }, {
      key: "EVMOS",
      value: "20537109",
    }, {
      key: "EVMOST",
      value: "23068725",
    }, {
      key: "provider",
      value: "lava@1wcw0xtpvfrernwhp6qj4v2hph25v78vtjupdly",
    }
  ],
}
EventDebug event 1149138 Source: Tx events type: lava_provider_latest_block_report 
 {
  type: "lava_provider_latest_block_report",
  attributes: [
    {
      key: "NEAR",
      value: "117882577",
    }, {
      key: "provider",
      value: "lava@1lamrmq78w6dnw5ahpyflus5ps7pvlwrtn9rf83",
    }
  ],
*/

export const ParseEventProviderLatestBlockReport = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider>,
  blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec>,
  blockchainEntitiesStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) => {

  const dbEvent: JsinfoSchema.InsertProviderLatestBlockReports = {
    blockId: height,
    tx: txHash,
    provider: null,
    timestamp: new Date(),
    chainId: '',
    chainBlockHeight: 0,
  }

  const chainToBlockDict: { [key: string]: number } = {};

  if (!EventProcessAttributes({
    caller: "ParseEventProviderLatestBlockReport",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      if (key === 'provider') {
        dbEvent.provider = EventParseProviderAddress(value);
      } else {
        chainToBlockDict[EventParseAlphaNumericString(key)] = EventParseInt(value);
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, blockchainEntitiesProviders, dbEvent.provider!, '')

  for (const [chainId, chainBlockHeight] of Object.entries(chainToBlockDict)) {
    const newEvent: JsinfoSchema.InsertProviderLatestBlockReports = {
      ...dbEvent,
      chainId,
      chainBlockHeight,
    };
    lavaBlock.dbProviderLatestBlockReports.push(newEvent);
  }

}