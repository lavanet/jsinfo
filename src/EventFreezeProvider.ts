import { Event } from "@cosmjs/stargate"
/*
//block 344537
lava_freeze_provider {
  type: 'lava_freeze_provider',
  attributes: [
    { key: 'freezeReason', value: 'maintenance' },
    {
      key: 'providerAddress',
      value: 'lava@1vu3xj8yv8280mx5pt64q4xg37692txwm422ymp'
    },
    { key: 'chainIDs', value: 'POLYGON1' },
    { key: 'freezeRequestBlock', value: '344537' }
  ]
}
*/
export type EventFreezeProvider = {
    providerAddress: string
    freezeReason: string
    chainIDs: string[]
    freezeRequestBlock: number
};

export const ParseEventFreezeProvider = (evt: Event): EventFreezeProvider => {
    const evtEvent: EventFreezeProvider = {
        providerAddress: '',
        freezeReason: '',
        chainIDs: [],
        freezeRequestBlock: 0,
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'providerAddress':
                evtEvent[key] = attr.value;
                break
            case 'freezeReason':
                evtEvent[key] = attr.value;
                break
            case 'chainIDs':
                evtEvent[key] = attr.value.split(',');
                break
            case 'freezeRequestBlock':
                evtEvent[key] = parseInt(attr.value);
                break
         }
    })
    return evtEvent;
}