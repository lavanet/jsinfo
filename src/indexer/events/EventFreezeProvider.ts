import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { GetOrSetProvider, SetTx } from "../setLatest";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
462524 {
  type: 'lava_freeze_provider',
  attributes: [
    { key: 'freezeReason', value: 'maintenance' },
    {
      key: 'providerAddress',
      value: 'lava@1m5p9cc4lp6jxdsk3pdf56tek2muzu3sm4rhp5f'
    },
    { key: 'chainIDs', value: 'COS5' },
    { key: 'freezeRequestBlock', value: '462524' }
  ]
}
*/

export const ParseEventFreezeProvider = (
    evt: Event,
    height: number,
    txHash: string | null,
    lavaBlock: LavaBlock,
    static_dbProviders: Map<string, JsinfoSchema.Provider>,
    static_dbSpecs: Map<string, JsinfoSchema.Spec>,
    static_dbPlans: Map<string, JsinfoSchema.Plan>,
    static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) => {
    const dbEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.FreezeProvider,
        consumer: null,
    }

    if (!EventProcessAttributes({
        caller: "ParseEventFreezeProvider",
        lavaBlock: lavaBlock,
        evt: evt,
        height: height,
        txHash: txHash,
        dbEvent: dbEvent,
        processAttribute: (key: string, value: string) => {
            switch (key) {
                case 'providerAddress':
                    dbEvent.provider = EventParseProviderAddress(value);
                    break
                case 'freezeReason':
                    dbEvent.t1 = value;
                    break
                case 'chainIDs':
                    dbEvent.t2 = value;
                    break
                case 'freezeRequestBlock':
                    dbEvent.i1 = EventParseInt(value)
                    break
            }
        },
        verifyFunction: () => !!dbEvent.provider
    })) return;

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, dbEvent.provider!, '')
    lavaBlock.dbEvents.push(dbEvent)
}