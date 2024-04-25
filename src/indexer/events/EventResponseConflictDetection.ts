import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetConsumer, SetTx, GetOrSetSpec } from "../setlatest";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
LavaBlockDebugDumpEvents txs event 1082970 lava_response_conflict_detection {
  type: "lava_response_conflict_detection",
  attributes: [
    {
      key: "apiInterface",
      value: "jsonrpc",
    }, {
      key: "apiURL",
      value: "",
    }, {
      key: "chainID",
      value: "ETH1",
    }, {
      key: "client",
      value: "lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpn",
    }, {
      key: "connectionType",
      value: "POST",
    }, {
      key: "metadata",
      value: "null",
    }, {
      key: "requestBlock",
      value: "19671235",
    }, {
      key: "requestData",
      value: "{\"jsonrpc\": \"2.0\", \"method\": \"eth_getBlockByNumber\", \"params\": [\"0x12c28c3\", true], \"id\": 2}",
    },
    {
      key: "voteDeadline",
      value: "1083120",
    }, {
      key: "voteID",
      value: "lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpnlava@1fpprhv40h9z058ez0hxdattjvg0fjsrhkqc7culava@1yx3c6h0gceg3pwz7vsed6mqwftu0456mcs4am91082940",
    },
    {
      key: "voters",
      value: "lava@1qtmhdxwszrdjum6mwfgg7mtzy2yr5rcvhvut9a,lava@1pphkhh9g0aqmq6jpksr54w8a8hypr8g4jngx9y,lava@1lamrmq78w6dnw5ahpyflus5ps7pvlwrtn9rf83,lava@1fveg058jn6e7r7vval9xrjuf0tysv25qcl05ad,lava@1kgdlk7g7wgkcjrmsh62rmc82qps60yadzunr5z,lava@1uhwudw7vzqtnffu2hf5yhv4n8trj79ezl66z99,lava@1tq8ngq6sh3k9wlysmp6hswnlt38hcctaqkwcjm,lava@1q7jyftyahuf66jefc36254rldk6je9xkf5t79z",
    }
  ],
}

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
  txHash: string | null,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, JsinfoSchema.Provider>,
  static_dbSpecs: Map<string, JsinfoSchema.Spec>,
  static_dbPlans: Map<string, JsinfoSchema.Plan>,
  static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) => {
  const evtEvent: JsinfoSchema.InsertConflictResponse = {
    tx: txHash,
    blockId: height,
  }

  if (!EventProcessAttributes("ParseEventResponseConflictDetection", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        /*
             case 'metadata':
             break
     
             case 'voters':
             value.split(',');
             break
           */
        case 'requestBlock':
          evtEvent.requestBlock = EventParseInt(value)
          break
        case 'voteDeadline':
          evtEvent.voteDeadline = EventParseInt(value)
          break
        case 'apiInterface':
          evtEvent.apiInterface = value;
          break
        case 'client':
          evtEvent.consumer = EventParseProviderAddress(value);
          break
        case 'voteID':
          evtEvent.voteId = value;
          break
        case 'chainID':
          evtEvent.specId = value;
          break
        case 'apiURL':
          evtEvent.apiURL = value;
          break
        case 'connectionType':
          evtEvent.connectionType = value;
          break
      }
    },
    verifyFunction: () => !!evtEvent.consumer,
    skipKeys: ['requestData']
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetSpec(lavaBlock.dbSpecs, static_dbSpecs, evtEvent.specId!)
  GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
  lavaBlock.dbConflictResponses.push(evtEvent)
}