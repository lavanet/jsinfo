import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetConsumer, GetOrSetTx, GetOrSetSpec } from "../setlatest";

/*
340836 {
  type: 'lava_response_conflict_detection',
  attributes: [
    { key: 'requestBlock', value: '122053565' },
    { key: 'voteDeadline', value: '340920' },
    { key: 'apiInterface', value: 'jsonrpc' },
    { key: 'metadata', value: 'null' },
    {
      key: 'client',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    {
      key: 'voteID',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uchlava@1e4vghfjertxq25l2vv56egkfkvdjk90t0c667vlava@1y0ptxml00gxca086ghe9zcl906cu7ljgvk5m28340830'
    },
    { key: 'chainID', value: 'ARB1' },
    { key: 'apiURL', value: '' },
    { key: 'connectionType', value: 'POST' },
    {
      key: 'requestData',
      value: '{"jsonrpc": "2.0", "method": "eth_getBlockByNumber", "params": ["0x74663bd", true], "id": 0}'
    },
    {
      key: 'voters',
      value: 'lava@1q7jyftyahuf66jefc36254rldk6je9xkf5t79z,lava@1rsuxf0acf4dy5nahd97uazvqgfkfqvq58rd8hd,lava@1mgfeywrg4lmfeth5kpxu65h79x5eustudngalr,lava@12u7dam8tyedr82ntwe6zz5e34n6vhr3kjlanaf,lava@1vfpuqq06426z3x4qsn38w6hdqrywqxlc6wmnxp,lava@1kyhxrg453u6lfc77jwezyxrhy0laeuk69cpk4e'
    }
  ]
}
*/

export const ParseEventResponseConflictDetection = (
  evt: Event,
  height: number,
  txHash: string,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  const evtEvent: schema.InsertConflictResponse = {
    tx: txHash,
    blockId: height,
  }

  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'));
    }
    switch (key) {
      /*
        case 'metadata':
        break

        case 'voters':
        attr.value.split(',');
        break
      */
      case 'requestBlock':
        evtEvent.requestBlock = parseInt(attr.value);
        break
      case 'voteDeadline':
        evtEvent.voteDeadline = parseInt(attr.value);
        break
      case 'apiInterface':
        evtEvent.apiInterface = attr.value;
        break
      case 'client':
        evtEvent.consumer = attr.value;
        break
      case 'voteID':
        evtEvent.voteId = attr.value;
        break
      case 'chainID':
        evtEvent.specId = attr.value;
        break
      case 'apiURL':
        evtEvent.apiURL = attr.value;
        break
      case 'connectionType':
        evtEvent.connectionType = attr.value;
        break

    }
  })

  GetOrSetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetSpec(lavaBlock.dbSpecs, static_dbSpecs, evtEvent.specId!)
  GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
  lavaBlock.dbPayments.push(evtEvent)
}