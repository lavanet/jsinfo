import { Event } from "@cosmjs/stargate"
/*
340836 {
  type: 'lava_response_conflict_detection',
  attributes: [
    { key: 'requestBlock', value: '122053565' },
    { key: 'voteDeadline', value: '340920' },
    { key: 'apiInterface', value: 'jsonrpc' },
    { key: 'metadata', value: 'null' },
    {
      key: 'client',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    {
      key: 'voteID',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uchlava@1e4vghfjertxq25l2vv56egkfkvdjk90t0c667vlava@1y0ptxml00gxca086ghe9zcl906cu7ljgvk5m28340830'
    },
    { key: 'chainID', value: 'ARB1' },
    { key: 'apiURL', value: '' },
    { key: 'connectionType', value: 'POST' },
    {
      key: 'requestData',
      value: '{"jsonrpc": "2.0", "method": "eth_getBlockByNumber", "params": ["0x74663bd", true], "id": 0}'
    },
    {
      key: 'voters',
      value: 'lava@1q7jyftyahuf66jefc36254rldk6je9xkf5t79z,lava@1rsuxf0acf4dy5nahd97uazvqgfkfqvq58rd8hd,lava@1mgfeywrg4lmfeth5kpxu65h79x5eustudngalr,lava@12u7dam8tyedr82ntwe6zz5e34n6vhr3kjlanaf,lava@1vfpuqq06426z3x4qsn38w6hdqrywqxlc6wmnxp,lava@1kyhxrg453u6lfc77jwezyxrhy0laeuk69cpk4e'
    }
  ]
}
*/

export type EventResponseConflictDetection = {
  requestBlock: number
  voteDeadline: number
  apiInterface: string
  metadata: string
  client: string
  voteID: string
  chainID: string
  apiURL: string
  connectionType: string
  requestData: string
  voters: string[]
};

export const ParseEventResponseConflictDetection = (evt: Event): EventResponseConflictDetection => {
  const evtEvent: EventResponseConflictDetection = {
    requestBlock: 0,
    voteDeadline: 0,
    apiInterface: '',
    metadata: '',
    client: '',
    voteID: '',
    chainID: '',
    apiURL: '',
    connectionType: '',
    requestData: '',
    voters: [],
  }
  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'));
    }
    switch (key) {
      case 'requestBlock':
        evtEvent[key] = parseInt(attr.value);
        break
      case 'voteDeadline':
        evtEvent[key] = parseInt(attr.value);
        break
      case 'apiInterface':
        evtEvent[key] = attr.value;
        break
      case 'metadata':
        evtEvent[key] = attr.value;
        break
      case 'client':
        evtEvent[key] = attr.value;
        break
      case 'voteID':
        evtEvent[key] = attr.value;
        break
      case 'chainID':
        evtEvent[key] = attr.value;
        break
      case 'apiURL':
        evtEvent[key] = attr.value;
        break
      case 'connectionType':
        evtEvent[key] = attr.value;
        break
      case 'voters':
        evtEvent[key] = attr.value.split(',');
        break
    }
  })
  return evtEvent;
}