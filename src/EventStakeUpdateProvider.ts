import { Event } from "@cosmjs/stargate"
/*
//block 340898
lava_stake_update_provider {
  type: 'lava_stake_update_provider',
  attributes: [
    { key: 'stakeAppliedBlock', value: '340899' },
    { key: 'stake', value: '50000000000ulava' },
    { key: 'moniker', value: 'MELLIFERA' },
    { key: 'spec', value: 'LAV1' },
    {
      key: 'provider',
      value: 'lava@1rgs6cp3vleue3vwffrvttjtl4laqhk8fthu466'
    }
  ]
}
*/
export type EventStakeUpdateProvider = {
    stakeAppliedBlock: number
    stake: number
    moniker: string
    spec: string
    provider: string
};

export const ParseEventStakeUpdateProvider = (evt: Event): EventStakeUpdateProvider => {
    const evtEvent: EventStakeUpdateProvider = {
        stakeAppliedBlock: 0,
        stake: 0,
        moniker: '',
        spec: '',
        provider: '',
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'stakeAppliedBlock':
                evtEvent[key] = parseInt(attr.value);
                break
            case 'stake':
                evtEvent[key] = parseInt(attr.value);
                break
            case 'moniker':
                evtEvent[key] = attr.value;
                break
            case 'spec':
                evtEvent[key] = attr.value;
                break
            case 'provider':
                evtEvent[key] = attr.value;
                break
         }
    })
    return evtEvent;
}