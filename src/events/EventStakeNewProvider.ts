import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetProvider, GetOrSetTx } from "../setlatest";

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

export const ParseEventStakeNewProvider = (
    evt: Event,
    height: number,
    txHash: string,
    lavaBlock: LavaBlock,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
    const evtEvent: schema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: schema.LavaProviderEventType.StakeNewProvider,
        consumer: null,
    }

    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'spec':
                evtEvent.t1 = attr.value;
                break
            case 'provider':
                evtEvent.provider = attr.value;
                break
            case 'stakeAppliedBlock':
                evtEvent.i1 = parseInt(attr.value);
                break
            case 'stake':
                evtEvent.b1 = parseInt(attr.value);
                break
            case 'geolocation':
                evtEvent.i1 = parseInt(attr.value);
                break
            case 'effectiveImmediately':
                evtEvent.i2 = attr.value == 'false' ? 0 : 1;
                break
            case 'moniker':
                evtEvent.t2 = attr.value;
                break
         }
    })

    GetOrSetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
    lavaBlock.dbEvents.push(evtEvent)
  
}