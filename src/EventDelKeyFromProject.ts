import { Event } from "@cosmjs/stargate"
/*
351669  {
  type: 'lava_del_key_from_project_event',
  attributes: [
    {
      key: 'project',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch-d064c8aa6149efbb98d633fcc7f50877'
    },
    {
      key: 'key',
      value: 'lava@1h5klcufu5ldyqzjcwdzz8qlx6yh7ytwvwa9ra3'
    },
    { key: 'keytype', value: '2' },
    { key: 'block', value: '351669' }
  ]
}
*/

export type EventDelKeyFromProject = {
    project: string
    key: string
    keytype: number
    block: number
};

export const ParseEventDelKeyFromProject = (evt: Event): EventDelKeyFromProject => {
    const evtEvent: EventDelKeyFromProject = {
        project: '',
        key: '',
        keytype: 0,
        block: 0,
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'project':
                evtEvent[key] = attr.value;
                break
            case 'key':
                evtEvent[key] = attr.value;
                break
            case 'keytype':
                evtEvent[key] = parseInt(attr.value);
                break
            case 'block':
                evtEvent[key] = parseInt(attr.value);
                break
        }
    })
    return evtEvent;
}