import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetConsumer, GetOrSetProvider, GetOrSetSpec, SetTx } from "../setlatest";

/*
462631 {
  type: 'lava_relay_payment',
  attributes: [
    { key: 'Mint.1', value: '150000ulava' },
    { key: 'ExcellenceQoSLatency.1', value: '0.039115400000000000' },
    { key: 'descriptionString.1', value: '7229806934220869017' },
    { key: 'QoSSync.1', value: '0.000000000000000000' },
    { key: 'totalCUInEpoch.1', value: '50' },
    {
      key: 'ExcellenceQoSAvailability.1',
      value: '0.993230920000000000'
    },
    {
      key: 'projectID.1',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch-admin'
    },
    { key: 'ExcellenceQoSSync.1', value: '0.000020120000000000' },
    { key: 'reliabilityPay.1', value: 'false' },
    { key: 'BasePay.1', value: '150000ulava' },
    { key: 'QoSScore.1', value: '0.000000000000000000' },
    {
      key: 'QoSReport.1',
      value: 'Latency: 1.000000000000000000, Availability: 1.000000000000000000, Sync: 0.000000000000000000'
    },
    { key: 'uniqueIdentifier.1', value: '5007474103256658834' },
    { key: 'chainID.1', value: 'LAV1' },
    { key: 'CU.1', value: '50' },
    { key: 'relayNumber.1', value: '5' },
    { key: 'clientFee.1', value: '0' },
    { key: 'badge.1', value: '[]' },
    {
      key: 'provider.1',
      value: 'lava@1dn5duttgdwu5l7nmhn7jnmpkk348k6t2r58mnp'
    },
    { key: 'QoSAvailability.1', value: '1.000000000000000000' },
    {
      key: 'client.1',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    { key: 'QoSLatency.1', value: '1.000000000000000000' }
  ]
}
*/

export const ParseEventRelayPayment = (
  evt: Event,
  height: number,
  txHash: string | null,
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
        evtEvent.relays = parseInt(attr.value)
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
        evtEvent.cu = parseInt(attr.value)
        break
      case 'client':
        evtEvent.consumer = attr.value;
        break
      case 'BasePay':
        evtEvent.pay = parseInt(attr.value)
        break
    }
  })

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  GetOrSetSpec(lavaBlock.dbSpecs, static_dbSpecs, evtEvent.specId!)
  GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
  lavaBlock.dbPayments.push(evtEvent)
}