import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
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
    const evtEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.FreezeProvider,
        consumer: null,
    }

    if (!EventProcessAttributes(lavaBlock, "ParseEventFreezeProvider", {
        evt: evt,
        height: height,
        txHash: txHash,
        processAttribute: (key: string, value: string) => {
            switch (key) {
                case 'providerAddress':
                    evtEvent.provider = EventParseProviderAddress(value);
                    break
                case 'freezeReason':
                    evtEvent.t1 = value;
                    break
                case 'chainIDs':
                    evtEvent.t2 = value;
                    break
                case 'freezeRequestBlock':
                    evtEvent.i1 = EventParseInt(value)
                    break
            }
        },
        verifyFunction: () => !!evtEvent.provider
    })) return;

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
    lavaBlock.dbEvents.push(evtEvent)
}