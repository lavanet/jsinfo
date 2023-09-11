import { Event } from "@cosmjs/stargate"
/*
340881 {
  type: 'lava_conflict_detection_received',
  attributes: [
    {
      key: 'client',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    }
  ]
}
*/

export type EventConflictDetectionReceived = {
    client: string
};

export const ParseEventConflictDetectionReceived = (evt: Event): EventConflictDetectionReceived => {
    const evtEvent: EventConflictDetectionReceived = {
        client: '',
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'client':
                evtEvent[key] = attr.value;
                break
         }
    })
    return evtEvent;
}