import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavaTypes";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress, EventParseInt, EventParseFloat } from "../eventUtils";

// 2024May31:
// checking event on https://lava.explorers.guru/transaction/D294DFDD8D39F0F6E096738F559783AD6ACC1FD606C5E9F7F30A0C49DC77FB3D
// descrptionString is - strconv.FormatUint(rws.serverID, 10)
// Mint and ClientFee are 0 in the code, reliabilityPay is false in the code
// Fulltext for this event is not stored
// totalCUInEpoch, rewardedCU, uniqueIdentifier - are not stored
// BasePay - does not exist in the event
// QoSReport - on chain and is not saved

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
  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  const dbEvent: JsinfoSchema.InsertRelayPayment = {
    tx: txHash,
    blockId: height,
    datetime: new Date(lavaBlock.datetime),
  }

  if (!EventProcessAttributes({
    caller: "ParseEventRelayPayment",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
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
                dbEvent.badge = res;
                break
              */

        // link data example:
        // https://lava.explorers.guru/transaction/D294DFDD8D39F0F6E096738F559783AD6ACC1FD606C5E9F7F30A0C49DC77FB3D
        // QoSReoprt is missing
        // ClientFee and Mint are missing - but they where always 0 - they are 0 in the code, reliabilityPay is also always false in the code
        // DescriptionString has a high value and is missing - it's this in the code - strconv.FormatUint(rws.serverID (type:TxRelayPayment), 10) - 
        // Also missing rewardedCu, totalCUInEpoch, 
        case 'relayNumber':
          dbEvent.relays = EventParseInt(value)
          break
        case 'ExcellenceQoSAvailability':
          dbEvent.qosAvailabilityExc = EventParseFloat(value);
          break
        case 'ExcellenceQoSLatency':
          dbEvent.qosLatencyExc = EventParseFloat(value);
          break
        case 'ExcellenceQoSSync':
          dbEvent.qosSyncExc = EventParseFloat(value);
          break
        case 'QoSSync':
          dbEvent.qosSync = EventParseFloat(value);
          break
        case 'QoSLatency':
          dbEvent.qosLatency = EventParseFloat(value);
          break
        case 'QoSAvailability':
          dbEvent.qosAvailability = EventParseFloat(value);
          break
        case 'provider':
          dbEvent.provider = EventParseProviderAddress(value);
          break
        case 'chainID':
          dbEvent.specId = value;
          break
        case 'CU':
          dbEvent.cu = EventParseInt(value)
          break
        case 'client':
          dbEvent.consumer = value;
          break
        case 'BasePay':
          dbEvent.pay = EventParseUlava(value)
          break
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;


  lavaBlock.dbPayments.push(dbEvent)
}