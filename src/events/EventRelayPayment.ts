import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetConsumer, GetOrSetProvider, GetOrSetSpec, GetOrSetTx } from "../setlatest";

/*
//block 355712
{
  type: 'lava_relay_payment',
  attributes: [
    { key: 'relayNumber.6', value: '703' },
    { key: 'uniqueIdentifier.6', value: '3383608703295002626' },
    { key: 'ExcellenceQoSAvailability.6', value: '0.999731740000000000'},
    { key: 'clientFee.6', value: '0' },
    { key: 'provider.6', value: 'lava@1uhwudw7vzqtnffu2hf5yhv4n8trj79ezl66z99'},
    { key: 'chainID.6', value: 'CELO' },
    { key: 'QoSSync.6', value: '0.998575498575498575' },
    { key: 'ExcellenceQoSLatency.6', value: '0.038088570000000000' },
    { key: 'reliabilityPay.6', value: 'false' },
    { key: 'QoSScore.6', value: '0.999524940546085479' },
    { key: 'CU.6', value: '25530' },
    { key: 'ExcellenceQoSSync.6', value: '0.000127620000000000' },
    { key: 'client.6', value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch' },
    { key: 'badge.6', value: '[]' },
    { key: 'Mint.6', value: '76590000ulava' },
    { key: 'BasePay.6', value: '76590000ulava' },
    { key: 'totalCUInEpoch.6', value: '240150' },
    { key: 'QoSLatency.6', value: '1.000000000000000000' },
    { key: 'QoSAvailability.6', value: '1.000000000000000000' },
    { key: 'projectID.6', value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch-admin'},
    { key: 'descriptionString.6', value: '6272409706814775257' },
    { key: 'QoSReport.6', value: 'Latency: 1.000000000000000000, Availability: 1.000000000000000000, Sync: 0.998575498575498575'}
  ]
}
*/

export const ParseEventRelayPayment = (
  evt: Event,
  height: number,
  txHash: string,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  const evtEvent: schema.InsertRelayPayment = {
    tx: txHash,
    blockId: height,
  }
  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'))
    }
    switch (key) {
      /*
      case 'clientFee':
        break
      case 'uniqueIdentifier':
        break
      case 'reliabilityPay':
        break
      case 'QoSScore':
        break
      case 'Mint':
        break
      case 'totalCUInEpoch':
        break
      case 'projectID':
        break
      case 'descriptionString':
        break
      case 'QoSReport':
        break
      case 'badge':
        if (attr.value.length == 2) {
          break
        }
        let s = attr.value.substring(1, attr.value.length - 2);
        let sT = s.split(' ');
        let res = '0x';
        for (var i = 0; i < sT.length; i++) {
          let h = parseInt(sT[i]).toString(16);
          res += h.length % 2 ? '0' + h : h;
        }
        evtEvent.badge = res;
        break
      */

      case 'relayNumber':
        evtEvent.relays = parseInt(attr.value);
        break
      case 'ExcellenceQoSAvailability':
        evtEvent.qosAvailabilityExc = parseFloat(attr.value);
        break
      case 'ExcellenceQoSLatency':
        evtEvent.qosLatencyExc = parseFloat(attr.value);
        break
      case 'ExcellenceQoSSync':
        evtEvent.qosSyncExc = parseFloat(attr.value);
        break
      case 'QoSSync':
        evtEvent.qosSync = parseFloat(attr.value);
        break
      case 'QoSLatency':
        evtEvent.qosLatency = parseFloat(attr.value);
        break
      case 'QoSAvailability':
        evtEvent.qosAvailability = parseFloat(attr.value);
        break
      case 'provider':
        evtEvent.provider = attr.value;
        break
      case 'chainID':
        evtEvent.specId = attr.value;
        break
      case 'CU':
        evtEvent.cu = parseInt(attr.value);
        break
      case 'client':
        evtEvent.consumer = attr.value;
        break
      case 'BasePay':
        evtEvent.pay = parseInt(attr.value);
        break
    }
  })

  GetOrSetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  GetOrSetSpec(lavaBlock.dbSpecs, static_dbSpecs, evtEvent.specId!)
  GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
  lavaBlock.dbPayments.push(evtEvent)
}