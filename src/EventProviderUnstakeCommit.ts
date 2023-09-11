import { Event } from "@cosmjs/stargate"
/*
//block 341096
lava_provider_unstake_commit {
  type: 'lava_provider_unstake_commit',
  attributes: [
    { key: 'geolocation', value: '2' },
    { key: 'moniker', value: '5ElementsNodes' },
    { key: 'stake', value: '50000600000' },
    {
      key: 'address',
      value: 'lava@1e8fz22klkvgd6treqml3twvzk8wlle0tq9zn9r'
    },
    { key: 'chainID', value: 'OPTM' }
  ]
}
*/
export type EventProviderUnstakeCommit = {
    geolocation: number
    moniker: string
    stake: number
    address: string
    chainID: string
};

export const ParseEventProviderUnstakeCommit = (evt: Event): EventProviderUnstakeCommit => {
    const evtEvent: EventProviderUnstakeCommit = {
        geolocation: 0,
        moniker: '',
        stake: 0,
        address: '',
        chainID: '',
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'geolocation':
                evtEvent[key] = parseInt(attr.value);
                break
            case 'moniker':
                evtEvent[key] = attr.value;
                break
            case 'stake':
                evtEvent[key] = parseInt(attr.value);
                break
            case 'address':
                evtEvent[key] = attr.value;
                break
            case 'chainID':
                evtEvent[key] = attr.value;
                break
            case 'effectiveImmediately':
         }
    })
    return evtEvent;
}