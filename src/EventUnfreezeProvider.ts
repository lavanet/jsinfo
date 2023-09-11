import { Event } from "@cosmjs/stargate"
/*
//block 360494
lava_unfreeze_provider {
  type: 'lava_unfreeze_provider',
  attributes: [
    {
      key: 'providerAddress',
      value: 'lava@1q7jyftyahuf66jefc36254rldk6je9xkf5t79z'
    },
    { key: 'chainIDs', value: 'FTM250' }
  ]
}
*/
export type EventUnfreezeProvider = {
    providerAddress: string
    chainIDs: string[]
};

export const ParseEventUnfreezeProvider = (evt: Event): EventUnfreezeProvider => {
    const evtEvent: EventUnfreezeProvider = {
        providerAddress: '',
        chainIDs: [],
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
            case 'chainIDs':
                evtEvent[key] = attr.value.split(',');
                break
         }
    })
    return evtEvent;
}