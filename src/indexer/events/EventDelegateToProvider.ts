import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { GetOrSetProvider, SetTx } from "../blockchainEntities/blockchainEntitiesGettersAndSetters";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
https://github.com/lavanet/lava/blob/0c0e4429d9ba5acf6c95d12e3cd130d0a05e6cfc/x/dualstaking/keeper/msg_server_delegate.go#L72

    details := map[string]string{
      "delegator": delegator,
      "provider":  provider,
      "chainID":   chainID,
      "amount":    amount.String(),
    }
    utils.LogLavaEvent(ctx, logger, types.DelegateEventName, details, "Delegate")
*/

/*
https://github.com/lavanet/lava/blob/0c0e4429d9ba5acf6c95d12e3cd130d0a05e6cfc/x/dualstaking/keeper/msg_server_claim_rewards.go#L38

    details := map[string]string{
      "delegator": msg.Creator,
      "provider":  msg.Provider,
      "claimed":   claimed.String(),
    }
    utils.LogLavaEvent(ctx, logger, types.DelegateEventName, details, "Claim Delegation Rewards")
*/

/*
EventDebug txs event 1079873 lava_delegate_to_provider {
  type: "lava_delegate_to_provider",
  attributes: [
    {
      key: "claimed",
      value: "",
    }, {
      key: "delegator",
      value: "lava@1m5p9cc4lp6jxdsk3pdf56tek2muzu3sm4rhp5f",
    }, {
      key: "provider",
      value: "",
    }
  ],
}
EventDebug txs event 1080786 lava_delegate_to_provider {
  type: "lava_delegate_to_provider",
  attributes: [
    {
      key: "amount",
      value: "50000000000ulava",
    }, {
      key: "chainID",
      value: "LAV1",
    }, {
      key: "delegator",
      value: "lava@1ml77pewe5g6ffn96vrkclzxpcujxsya8ws7m6l",
    }, {
      key: "provider",
      value: "lava@1ml77pewe5g6ffn96vrkclzxpcujxsya8ws7m6l",
    }
  ],
}
EventDebug txs event 1079916 lava_delegate_to_provider {
  type: "lava_delegate_to_provider",
  attributes: [
    {
      key: "claimed",
      value: "",
    }, {
      key: "delegator",
      value: "lava@1mctq6e0vg75hcv8x08zekajpy2jj3zt87hkwg8",
    }, {
      key: "provider",
      value: "",
    }
  ],
}
EventDebug txs event 1079872 lava_delegate_to_provider {
  type: "lava_delegate_to_provider",
  attributes: [
    {
      key: "claimed",
      value: "",
    }, {
      key: "delegator",
      value: "lava@1m5p9cc4lp6jxdsk3pdf56tek2muzu3sm4rhp5f",
    }, {
      key: "provider",
      value: "",
    }
  ],
}
*/

export const ParseEventDelegateToProvider = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,


  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  let delegator: string | null = null;
  let provider: string | null = null;

  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.DelegateToProvider,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventDelegateToProvider",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'delegator':
          delegator = EventParseProviderAddress(value);
          break;
        case 'provider':
          provider = EventParseProviderAddress(value);
          break;
        case 'chainID':
          dbEvent.t2 = value;
          break
        case 'amount':
          dbEvent.t3 = value;
          break
        // case 'amount':
        //   dbEvent.b1 = EventParseUlava(value);
        //   break
      }
    },
    verifyFunction: () => !!delegator || !!provider
  })) return;

  if (delegator !== provider) {
    const delegatorEvent = {
      ...dbEvent, provider:
        delegator,
      t1: provider ? `provider: ${provider}` : null,
    };

    lavaBlock.dbEvents.push(delegatorEvent);
  }

  dbEvent.provider = provider;
  dbEvent.t1 = delegator ? `delegator: ${delegator}` : null


  GetOrSetProvider(lavaBlock.dbProviders, dbEvent.provider!, '')
  lavaBlock.dbEvents.push(dbEvent)
}