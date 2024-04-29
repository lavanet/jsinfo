import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetConsumer, GetOrSetProvider, GetOrSetSpec, SetTx } from "../setlatest";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress, EventParseInt, EventParseFloat } from "../eventUtils";

// Mint is not used

/*
EventDebug txs event 1085946 lava_relay_payment {
  type: "lava_relay_payment",
  attributes: [
    {
      key: "CU.0",
      value: "20",
    }, {
      key: "Mint.0",
      value: "0ulava",
    }, {
      key: "badge.0",
      value: "[]",
    }, {
      key: "chainID.0",
      value: "NEAR",
    }, {
      key: "client.0",
      value: "lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch",
    }, {
      key: "clientFee.0",
      value: "0",
    }, {
      key: "descriptionString.0",
      value: "5114258776193815566",
    }, {
      key: "epoch.0",
      value: "1085760",
    }, {
      key: "projectID.0",
      value: "lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch-admin",
    }, {
      key: "provider.0",
      value: "lava@1zvfemd9cagdw4aey6jl07nes6zvx43u6vfzf7y",
    }, {
      key: "relayNumber.0",
      value: "1",
    }, {
      key: "reliabilityPay.0",
      value: "false",
    }, {
      key: "rewardedCU.0",
      value: "20",
    }, {
      key: "totalCUInEpoch.0",
      value: "20",
    }, {
      key: "uniqueIdentifier.0",
      value: "4666018930052472881",
    }
  ],
}

EventDebug txs event 1085946 lava_relay_payment {
  type: "lava_relay_payment",
  attributes: [
    {
      key: "CU.77",
      value: "3180",
    }, {
      key: "ExcellenceQoSAvailability.77",
      value: "0.988059910000000000",
    }, {
      key: "ExcellenceQoSLatency.77",
      value: "0.133539060000000000",
    }, {
      key: "ExcellenceQoSSync.77",
      value: "0.001692650000000000",
    }, {
      key: "Mint.77",
      value: "0ulava",
    }, {
      key: "QoSAvailability.77",
      value: "0.875389408099688470",
    }, {
      key: "QoSLatency.77",
      value: "1.000000000000000000",
    }, {
      key: "QoSReport.77",
      value: "Latency: 1.000000000000000000, Availability: 0.875389408099688470, Sync: 1.000000000000000000",
    },
    {
      key: "QoSScore.77",
      value: "0.956607458132770241",
    }, {
      key: "QoSSync.77",
      value: "1.000000000000000000",
    }, {
      key: "badge.77",
      value: "[]",
    }, {
      key: "chainID.77",
      value: "AXELART",
    }, {
      key: "client.77",
      value: "lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpn",
    }, {
      key: "clientFee.77",
      value: "0",
    }, {
      key: "descriptionString.77",
      value: "1645439606670551043",
    }, {
      key: "epoch.77",
      value: "1085760",
    }, {
      key: "projectID.77",
      value: "lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpn-admin",
    }, {
      key: "provider.77",
      value: "lava@1rgs6cp3vleue3vwffrvttjtl4laqhk8fthu466",
    }, {
      key: "relayNumber.77",
      value: "322",
    }, {
      key: "reliabilityPay.77",
      value: "false",
    }, {
      key: "rewardedCU.77",
      value: "3180",
    }, {
      key: "totalCUInEpoch.77",
      value: "13280",
    }, {
      key: "uniqueIdentifier.77",
      value: "4340323419503293897",
    }
  ],
}

462631 {
  type: 'lava_relay_payment',
  attributes: [
    { key: 'Mint.1', value: '150000ulava' },
    { key: 'ExcellenceQoSLatency.1', value: '0.039115400000000000' },
    { key: 'descriptionString.1', value: '7229806934220869017' },
    { key: 'QoSSync.1', value: '0.000000000000000000' },
    { key: 'totalCUInEpoch.1', value: '50' },
    {
      key: 'ExcellenceQoSAvailability.1',
      value: '0.993230920000000000'
    },
    {
      key: 'projectID.1',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch-admin'
    },
    { key: 'ExcellenceQoSSync.1', value: '0.000020120000000000' },
    { key: 'reliabilityPay.1', value: 'false' },
    { key: 'BasePay.1', value: '150000ulava' },
    { key: 'QoSScore.1', value: '0.000000000000000000' },
    {
      key: 'QoSReport.1',
      value: 'Latency: 1.000000000000000000, Availability: 1.000000000000000000, Sync: 0.000000000000000000'
    },
    { key: 'uniqueIdentifier.1', value: '5007474103256658834' },
    { key: 'chainID.1', value: 'LAV1' },
    { key: 'CU.1', value: '50' },
    { key: 'relayNumber.1', value: '5' },
    { key: 'clientFee.1', value: '0' },
    { key: 'badge.1', value: '[]' },
    {
      key: 'provider.1',
      value: 'lava@1dn5duttgdwu5l7nmhn7jnmpkk348k6t2r58mnp'
    },
    { key: 'QoSAvailability.1', value: '1.000000000000000000' },
    {
      key: 'client.1',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    { key: 'QoSLatency.1', value: '1.000000000000000000' }
  ]
}
*/

export const ParseEventRelayPayment = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, JsinfoSchema.Provider>,
  static_dbSpecs: Map<string, JsinfoSchema.Spec>,
  static_dbPlans: Map<string, JsinfoSchema.Plan>,
  static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) => {
  const evtEvent: JsinfoSchema.InsertRelayPayment = {
    tx: txHash,
    blockId: height,
    datetime: new Date(lavaBlock.datetime),
  }

  if (!EventProcessAttributes(lavaBlock, "ParseEventRelayPayment", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        /*
              case 'clientFee':
                break
              case 'uniqueIdentifier':
                break
              case 'reliabilityPay':
                break
              case 'QoSScore':
                break
              case 'Mint':
                break
              case 'totalCUInEpoch':
                break
              case 'projectID':
                break
              case 'descriptionString':
                break
              case 'QoSReport':
                break
              case 'badge':
                if (value.length == 2) {
                  break
                }
                let s = value.substring(1, value.length - 2);
                let sT = s.split(' ');
                let res = '0x';
                for (var i = 0; i < sT.length; i++) {
                  let h = EventParseInt(sT[i]).toString(16);
                  res += h.length % 2 ? '0' + h : h;
                }
                evtEvent.badge = res;
                break
              */

        case 'relayNumber':
          evtEvent.relays = EventParseInt(value)
          break
        case 'ExcellenceQoSAvailability':
          evtEvent.qosAvailabilityExc = EventParseFloat(value);
          break
        case 'ExcellenceQoSLatency':
          evtEvent.qosLatencyExc = EventParseFloat(value);
          break
        case 'ExcellenceQoSSync':
          evtEvent.qosSyncExc = EventParseFloat(value);
          break
        case 'QoSSync':
          evtEvent.qosSync = EventParseFloat(value);
          break
        case 'QoSLatency':
          evtEvent.qosLatency = EventParseFloat(value);
          break
        case 'QoSAvailability':
          evtEvent.qosAvailability = EventParseFloat(value);
          break
        case 'provider':
          evtEvent.provider = EventParseProviderAddress(value);
          break
        case 'chainID':
          evtEvent.specId = value;
          break
        case 'CU':
          evtEvent.cu = EventParseInt(value)
          break
        case 'client':
          evtEvent.consumer = value;
          break
        case 'BasePay':
          evtEvent.pay = EventParseUlava(value)
          break
      }
    },
    verifyFunction: () => !!evtEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  GetOrSetSpec(lavaBlock.dbSpecs, static_dbSpecs, evtEvent.specId!)
  GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
  lavaBlock.dbPayments.push(evtEvent)
}