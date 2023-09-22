import { Event } from "@cosmjs/stargate"
/*
//block 340870
lava_stake_new_provider {
  type: 'lava_stake_new_provider',
  attributes: [
    { key: 'spec', value: 'AVAX' },
    {
      key: 'provider',
      value: 'lava@16slsjlavjlm8ganzrqtqhm8tnzj7w3xqycnhv9'
    },
    { key: 'stakeAppliedBlock', value: '340871' },
    { key: 'stake', value: '50000000000ulava' },
    { key: 'geolocation', value: '2' },
    { key: 'effectiveImmediately', value: 'false' },
    { key: 'moniker', value: 'mahof' }
  ]
}
*/
export type EventStakeNewProvider = {
    spec: string
    provider: string
    stakeAppliedBlock: number
    stake: number
    geolocation: number
    effectiveImmediately: boolean
    moniker: string
};

export const ParseEventStakeNewProvider = (evt: Event): EventStakeNewProvider => {
    const evtEvent: EventStakeNewProvider = {
        spec: '',
        provider: '',
        stakeAppliedBlock: 0,
        stake: 0,
        geolocation: 0,
        effectiveImmediately: false,
        moniker: '',
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'spec':
                evtEvent[key] = attr.value;
                break
            case 'provider':
                evtEvent[key] = attr.value;
                break
            case 'stakeAppliedBlock':
                evtEvent[key] = parseInt(attr.value);
                break
            case 'stake':
                evtEvent[key] = parseInt(attr.value);
                break
            case 'geolocation':
                evtEvent[key] = parseInt(attr.value);
                break
            case 'effectiveImmediately':
                evtEvent[key] = attr.value == 'false' ? false : true;
                break
            case 'moniker':
                evtEvent[key] = attr.value;
                break
         }
    })
    return evtEvent;
}