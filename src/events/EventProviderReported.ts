import { Event } from "@cosmjs/stargate"

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

export type EventProviderReported = {
  cu: number
  disconnections: number
  epoch: number
  errors: number
  project: string
  provider: string
  timestamp: number
  total_complaint_this_epoch: number
};

export const ParseEventProviderReported = (evt: Event): EventProviderReported => {
  const evtEvent: EventProviderReported = {
    cu: 0,
    disconnections: 0,
    epoch: 0,
    errors: 0,
    project: '',
    provider: '',
    timestamp: 0,
    total_complaint_this_epoch: 0,
  }
  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'));
    }
    switch (key) {
      case 'cu':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'disconnections':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'epoch':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'errors':
        evtEvent[key] = parseInt(attr.value);
        break;
      case 'project':
        evtEvent[key] = attr.value;
        break;
      case 'provider':
        evtEvent[key] = attr.value;
        break;
      case 'timestamp':
        evtEvent[key] = Date.parse(attr.value);
        break;
      case 'total_complaint_this_epoch':
        evtEvent[key] = parseInt(attr.value);
        break;
    }
  })
  return evtEvent;
}