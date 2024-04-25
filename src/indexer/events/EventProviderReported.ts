import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

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
  static_dbProviders: Map<string, JsinfoSchema.Provider>,
  static_dbSpecs: Map<string, JsinfoSchema.Spec>,
  static_dbPlans: Map<string, JsinfoSchema.Plan>,
  static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) => {
  const evtEvent: JsinfoSchema.InsertProviderReported = {
    blockId: height,
    tx: txHash,
  }

  if (!EventProcessAttributes("ParseEventProviderReported", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'cu':
          evtEvent.cu = EventParseInt(value)
          break
        case 'disconnections':
          evtEvent.disconnections = EventParseInt(value)
          break
        case 'epoch':
          evtEvent.epoch = EventParseInt(value)
          break
        case 'errors':
          evtEvent.errors = EventParseInt(value)
          break
        case 'project':
          evtEvent.project = value;
          break
        case 'provider':
          evtEvent.provider = EventParseProviderAddress(value);
          break
        case 'timestamp':
          evtEvent.datetime = new Date(Date.parse(value));
          break
        case 'total_complaint_this_epoch':
          evtEvent.totalComplaintEpoch = EventParseInt(value)
          break
      }
    },
    verifyFunction: () => !!evtEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbProviderReports.push(evtEvent)
}