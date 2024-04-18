import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

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
LavaBlockDebugDumpEvents txs event 1079873 lava_delegate_to_provider {
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
LavaBlockDebugDumpEvents txs event 1080786 lava_delegate_to_provider {
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
LavaBlockDebugDumpEvents txs event 1079916 lava_delegate_to_provider {
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
LavaBlockDebugDumpEvents txs event 1079872 lava_delegate_to_provider {
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
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  let delegator: string | null = null;
  let provider: string | null = null;

  const evtEvent: schema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: schema.LavaProviderEventType.DelegateToProvider,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes("ParseEventDelegateToProvider", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'delegator':
          if (value.startsWith('lava@')) delegator = EventParseProviderAddress(value);
          break;
        case 'provider':
          if (value.startsWith('lava@')) provider = EventParseProviderAddress(value);
          break;
        case 'chainID':
          evtEvent.t2 = value;
          break
        case 'amount':
          evtEvent.b1 = EventParseUlava(value);
          break
      }
    },
    verifyFunction: () => !!delegator || !!provider
  })) return;

  if (delegator !== provider) {
    const delegatorEvent = {
      ...evtEvent, provider:
        delegator,
      t1: provider ? `provider: ${provider}` : null,
    };
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, delegatorEvent.provider!, '')
    lavaBlock.dbEvents.push(delegatorEvent);
  }

  evtEvent.provider = provider;
  evtEvent.t1 = delegator ? `delegator: ${delegator}` : null

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)
}