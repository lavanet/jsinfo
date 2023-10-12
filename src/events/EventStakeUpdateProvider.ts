import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";

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

export const ParseEventStakeUpdateProvider = (
    evt: Event,
    height: number,
    txHash: string | null,
    lavaBlock: LavaBlock,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
    const evtEvent: schema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: schema.LavaProviderEventType.StakeUpdateProvider,
        consumer: null,
    }

    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'))
        }
        switch (key) {
            case 'stakeAppliedBlock':
                evtEvent.i1 = parseInt(attr.value)
                break
            case 'stake':
                evtEvent.b1 = parseInt(attr.value)
                break
            case 'moniker':
                evtEvent.t1 = attr.value;
                break
            case 'spec':
                evtEvent.t2 = attr.value;
                break
            case 'provider':
                evtEvent.provider = attr.value;
                break
        }
    })

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
    lavaBlock.dbEvents.push(evtEvent)
}