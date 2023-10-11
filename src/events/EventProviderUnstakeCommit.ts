import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetProvider, GetOrSetTx } from "../setlatest";

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

export const ParseEventProviderUnstakeCommit = (
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
        eventType: schema.LavaProviderEventType.ProviderUnstakeCommit,
        consumer: null,
    }   

    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'geolocation':
                evtEvent.i1 = parseInt(attr.value);
                break
            case 'moniker':
                evtEvent.t1 = attr.value;
                break
            case 'stake':
                evtEvent.b1 = parseInt(attr.value);
                break
            case 'address':
                evtEvent.provider = attr.value;
                break
            case 'chainID':
                evtEvent.t2 = attr.value;
                break
            case 'effectiveImmediately':
         }
    })

    GetOrSetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
    lavaBlock.dbEvents.push(evtEvent)
}