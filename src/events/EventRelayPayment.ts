import { Event } from "@cosmjs/stargate"

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

export type EventRelayPayment = {
  relayNumber: number
  uniqueIdentifier: number
  ExcellenceQoSAvailability: number
  //clientFee: number // TODO is this always 0?
  provider: string
  chainID: string
  QoSSync: number
  ExcellenceQoSLatency: number
  reliabilityPay: boolean
  QoSScore: number
  CU: number
  ExcellenceQoSSync: number
  client: string
  badge: string
  Mint: number
  BasePay: number
  totalCUInEpoch: number
  QoSLatency: number
  QoSAvailability: number
  projectID: string
  descriptionString: string
  QoSReport: string
};

export const ParseEventRelayPayment = (evt: Event): EventRelayPayment => {
  const evtEvent: EventRelayPayment = {
    relayNumber: 0,
    uniqueIdentifier: 0,
    ExcellenceQoSAvailability: 0,
    //clientFee: 0,
    provider: '',
    chainID: '',
    QoSSync: 0,
    ExcellenceQoSLatency: 0,
    reliabilityPay: false,
    QoSScore: 0,
    CU: 0,
    ExcellenceQoSSync: 0,
    client: '',
    badge: '',
    Mint: 0,
    BasePay: 0,
    totalCUInEpoch: 0,
    QoSLatency: 0,
    QoSAvailability: 0,
    projectID: '',
    descriptionString: '',
    QoSReport: '',
  }
  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'));
    }
    switch (key) {
      case 'relayNumber':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'uniqueIdentifier':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'ExcellenceQoSAvailability':
        evtEvent[key] = parseFloat(attr.value);
        break;
      /*case 'clientFee':
        break;*/
      case 'provider':
        evtEvent[key] = attr.value;
        break;
      case 'chainID':
        evtEvent[key] = attr.value;
        break;
      case 'QoSSync':
        evtEvent[key] = parseFloat(attr.value);
        break;
      case 'ExcellenceQoSLatency':
        evtEvent[key] = parseFloat(attr.value);
        break;
      case 'reliabilityPay':
        attr.value == 'false' ? false : true;
        break;
      case 'QoSScore':
        evtEvent[key] = parseFloat(attr.value);
        break;
      case 'CU':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'ExcellenceQoSSync':
        evtEvent[key] = parseFloat(attr.value);
        break;
      case 'client':
        evtEvent[key] = attr.value;
        break;
      case 'badge':
        if (attr.value.length == 2) {
          break;
        }
        let s = attr.value.substring(1, attr.value.length-2);
        let sT = s.split(' ');
        let res = '0x';
        for (var i = 0; i < sT.length; i++) {
          let h = parseInt(sT[i]).toString(16);
          res += h.length % 2 ? '0' + h : h;
        }     
        evtEvent[key] = res;
        break;
      case 'Mint':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'BasePay':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'totalCUInEpoch':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'QoSLatency':
        evtEvent[key] = parseFloat(attr.value);
        break;
      case 'QoSAvailability':
        evtEvent[key] = parseFloat(attr.value);
        break;
      case 'projectID':
        evtEvent[key] = attr.value;
        break;
      case 'descriptionString':
        evtEvent[key] = attr.value;
        break;
      case 'QoSReport':
        evtEvent[key] = attr.value;
        break;
    }
  })
  return evtEvent;
}