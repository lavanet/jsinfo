import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetProvider, GetOrSetTx } from "../setlatest";

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
  txHash: string,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  const evtEvent: schema.InsertProviderReported = {
    blockId: height,
    tx: txHash,
  }
  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'));
    }
    switch (key) {
      case 'cu':
        evtEvent.cu = parseInt(attr.value);
        break;
      case 'disconnections':
        evtEvent.disconnections = parseInt(attr.value);
        break;
      case 'epoch':
        evtEvent.epoch = parseInt(attr.value);
        break;
      case 'errors':
        evtEvent.errors = parseInt(attr.value);
        break;
      case 'project':
        evtEvent.project = attr.value;
        break;
      case 'provider':
        evtEvent.provider = attr.value;
        break;
      case 'timestamp':
        evtEvent.datetime = new Date(Date.parse(attr.value));
        break;
      case 'total_complaint_this_epoch':
        evtEvent.totalComplaintEpoch = parseInt(attr.value);
        break;
    }
  })

  GetOrSetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbProviderReports.push(evtEvent)
}