import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { GetOrSetProvider, SetTx } from "../setLatest";
import { EventProcessAttributes, EventParseInt } from "../eventUtils";

/*
1500437	1000	 	1138596	{"type":"lava_provider_bonus_rewards","lava@1020d3e7yk2zl3neh86ja4mwhwwc8wh2g82j3wu LAV1":"23403000","lava@1066rljqtct0y969whtagf9v68a86gwg5jycfyf LAV1":"5392500","lava@1066rljqtct0y969whtagf9v68a86gwg5jycfyf STRGZ":"278884000","lava@10a0sjm3dzfgd0zrmgscw6rm6curqqj2apy4ern AXELAR":"36798582654","lava@10a0sjm3dzfgd0zrmgscw6rm6curqqj2apy4ern EVMOS":"6746228766","lava@10a0sjm3dzfgd0zrmgscw6rm6curqqj2apy4ern NEAR":"282175625145","lava@10h0ly2066gdnlq508ekq42auwt6rmvc0n5xpj4 ARB1":"9852576026","lava@10h0ly2066gdnlq508ekq42auwt6rmvc0n5xpj4 AXELAR":"15759800105","lava@10h0ly2066gdnlq508ekq42auwt6rmvc0n5xpj4 BLAST":"805817","lava@10h0ly2066gdnlq508ekq42auwt6rmvc0n5xpj4 ETH1":"627932218620","lava@10h0ly2066gdnlq508ekq42auwt6rmvc0n5xpj4 EVMOS":"28456812563","lava@10h0ly2066gdnlq508ekq42auwt6rmvc0n5xpj4 LAV1":"283050728","lava@10h0ly2066gdnlq508ekq42auwt6rmvc0n5xpj4 NEAR":"8294004045","lava@10h0ly2066gdnlq508ekq42auwt6rmvc0n5xpj4 OPTM":"65394529630","lava@10h0ly2066gdnlq508ekq42auwt6rmvc0n5xpj4 POLYGON1":"152090780071","lava@10z2xdduvs23hwl6368m37hk7raprz75vacajhf AXELAR":"48150639000","lava@10z2xdduvs23hwl6368m37hk7raprz75vacajhf EVMOS":"130000","lava@10z2xdduvs23hwl6368m37hk7raprz75vacajhf LAV1":"327148500","lava@10z2xdduvs23hwl6368m37hk7raprz75vacajhf NEAR":"5000","lava@123n20jr7qu0lqfksjddzhzdnzvmk6q36vdsvra AXELAR":"5000","lava@125xzjslh36v5g76cypzslplqm64mhzz03mwnec AVAX":"35069543675","lava@125xzjslh36v5g76cypzslplqm64mhzz03mwnec AXELAR":"21297765489",
*/

export const ParseEventProviderBonusRewards = (
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
    eventType: JsinfoSchema.LavaProviderEventType.ProviderBonusRewards,
    consumer: null,
    provider: null,
  }

  const providerInfo: { [provider: string]: { chain: string, amount: number } } = {};

  if (!EventProcessAttributes({
    caller: "ParseEventProviderBonusRewards",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      const [provider, chain] = key.split(' ');
      providerInfo[provider] = { chain, amount: EventParseInt(value) };
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)

  // Loop for each provider parsed
  for (const [provider, { chain, amount }] of Object.entries(providerInfo)) {
    const dbEventInstance: JsinfoSchema.InsertEvent = {
      ...dbEvent,
      provider: provider,
      t1: chain,
      r1: amount,
      fulltext: JSON.stringify({ chain: chain, amount: amount }),
    };

    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, provider, '');
    lavaBlock.dbEvents.push(dbEventInstance);
  }
}