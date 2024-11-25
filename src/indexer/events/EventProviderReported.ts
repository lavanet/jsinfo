import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavaTypes";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
2024-11-10T13:02:05.941Z debug: Provider Report Event {"type":"lava_provider_reported","content":{"type":"lava_provider_reported","attributes":[{"key":"chainID","value":"CELESTIATM"},{"key":"cu","value":"17"},{"key":"disconnections","value":"200"},{"key":"epoch","value":"2166780"},{"key":"errors","value":"0"},{"key":"project","value":"lava@1a2fq5sujfwvgz950cndfzsfcx7pnct8yymdant-gateway_eu"},{"key":"provider","value":"lava@1m5p9cc4lp6jxdsk3pdf56tek2muzu3sm4rhp5f"},{"key":"timestamp","value":"2024-11-08 14:58:27"},{"key":"total_complaint_this_epoch","value":"119"}]},"height":2166973,"source":"Tx events"}
*/
/*
//block 472892
{
  type: 'lava_provider_reported',
  attributes: [
    { key: 'cu', value: '10' },
    { key: 'disconnections', value: '0' },
    { key: 'epoch', value: '472800' },
    { key: 'errors', value: '4' },
    {
      key: 'project',
      value: 'lava@1mh9d3vdthekxvc0aflnvzhurv2585aakzs9e3a-admin'
    },
    {
      key: 'provider',
      value: 'lava@1pdd0nmuj0xfwhfyt7h3wkx9zgjvs3hzle28scu'
    },
    { key: 'timestamp', value: '2023-10-03 13:06:02' },
    { key: 'total_complaint_this_epoch', value: '4894' }
  ]
}
*/

export const ParseEventProviderReported = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,

) => {
  const dbEvent: JsinfoSchema.InsertProviderReported = {
    blockId: height,
    tx: txHash,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventProviderReported",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'cu':
          dbEvent.cu = EventParseInt(value)
          break
        case 'disconnections':
          dbEvent.disconnections = EventParseInt(value)
          break
        case 'epoch':
          dbEvent.epoch = EventParseInt(value)
          break
        case 'errors':
          dbEvent.errors = EventParseInt(value)
          break
        case 'project':
          dbEvent.project = value;
          break
        case 'provider':
          dbEvent.provider = EventParseProviderAddress(value);
          break
        case 'timestamp':
          dbEvent.datetime = new Date(Date.parse(value));
          break
        case 'total_complaint_this_epoch':
          dbEvent.totalComplaintEpoch = EventParseInt(value)
          break
        case 'chainID':
          dbEvent.chainId = value;
          break
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;



  lavaBlock.dbProviderReports.push(dbEvent)
}