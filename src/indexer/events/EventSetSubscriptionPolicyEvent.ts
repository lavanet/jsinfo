import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";
import { GetOrSetProvider, SetTx } from '../blockchainEntities/blockchainEntitiesGettersAndSetters';

/*
SELECT * FROM events  WHERE event_type >= 1000 AND t1 not like '%lava_provider_temporary_jailed%'  AND t1 not like '%set_withdraw_address%' AND t1 not like '%lava_delegator_claim_rewards%' AND t1 not like '%cosmos.authz.v1beta1.EventGrant%' AND t1 not like '%lava_set_subscription_policy_event%' AND t1 not like '%lava_unstake_from_unbond%' ORDER BY "id" desc LIMIT 100

{"type":"lava_set_subscription_policy_event"}

{"creator":"lava@1a2fq5sujfwvgz950cndfzsfcx7pnct8yymdant","policy":"chain_policies:<chain_id:\"LAV1\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"NEAR\" requirements:<collection:<api_interface:\"jsonrpc\" type:\"POST\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"NEART\" requirements:<collection:<api_interface:\"jsonrpc\" type:\"POST\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"STRK\" requirements:<collection:<api_interface:\"jsonrpc\" type:\"POST\" add_on:\"trace\" > mixed:true > > chain_policies:<chain_id:\"ETH1\" requirements:<collection:<api_interface:\"jsonrpc\" type:\"POST\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"EVMOS\" requirements:<collection:<api_interface:\"jsonrpc\" type:\"POST\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"AXELAR\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"COS3\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"COS5\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"OSMOSIS\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"COSMOSHUB\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"SQDSUBGRAPH\" requirements:<collection:<api_interface:\"rest\" type:\"POST\" add_on:\"compound-v3\" > mixed:true > requirements:<collection:<api_interface:\"rest\" type:\"POST\" add_on:\"aave-v3\" > mixed:true > > chain_policies:<chain_id:\"*\" > geolocation_profile:32 total_cu_limit:9223372036854775807 epoch_cu_limit:9223372036854775807 max_providers_to_pair:100 ","project_ids":"lava@1a2fq5sujfwvgz950cndfzsfcx7pnct8yymdant-iprpc_as, "}

ProcessOneEvent:: Uknown event 1038480 lava_set_subscription_policy_event {
  type: "lava_set_subscription_policy_event",
  attributes: [
    {
      key: "creator",
      value: "lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpn",
    }, {
      key: "policy",
      value: "chain_policies:<chain_id:\"NEAR\" requirements:<collection:<api_interface:\"jsonrpc\" type:\"POST\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"STRK\" requirements:<collection:<api_interface:\"jsonrpc\" type:\"POST\" add_on:\"trace\" > mixed:true > > chain_policies:<chain_id:\"ETH1\" requirements:<collection:<api_interface:\"jsonrpc\" type:\"POST\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"EVMOS\" requirements:<collection:<api_interface:\"jsonrpc\" type:\"POST\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"AXELAR\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"COS3\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"COS5\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"OSMOSIS\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"COSMOSHUB\" requirements:<collection:<api_interface:\"rest\" type:\"GET\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"tendermintrpc\" > extensions:\"archive\" mixed:true > requirements:<collection:<api_interface:\"grpc\" > extensions:\"archive\" mixed:true > > chain_policies:<chain_id:\"SQDSUBGRAPH\" requirements:<collection:<api_interface:\"rest\" type:\"POST\" add_on:\"compound-v3\" > mixed:true > requirements:<collection:<api_interface:\"rest\" type:\"POST\" add_on:\"aave-v3\" > mixed:true > > chain_policies:<chain_id:\"*\" > geolocation_profile:32 total_cu_limit:9223372036854775807 epoch_cu_limit:9223372036854775807 max_providers_to_pair:100 ",
    },
    {
      key: "project_ids",
      value: "lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpn-admin, ",
    }
  ],
}
*/

export const ParseEventSetSubscriptionPolicyEvent = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider>,
  blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec>,
  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {

  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.SetSubscriptionPolicyEvent,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventSetSubscriptionPolicyEvent",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'creator':
          dbEvent.provider = EventParseProviderAddress(value);
          break;
        case 'policy':
          dbEvent.t1 = value;
          break;
        case 'project_ids':
          dbEvent.t2 = value;
          break;
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, blockchainEntitiesProviders, dbEvent.provider!, '')
  lavaBlock.dbEvents.push(dbEvent)
}