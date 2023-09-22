import { Event } from "@cosmjs/stargate"
/*
371879  {
  type: 'lava_del_project_to_subscription_event',
  attributes: [
    {
      key: 'subscription',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    { key: 'projectName', value: '07042678b43520acb7e2c2e50d18a89e' }
  ]
}
*/

export type EventDelProjectToSubscription = {
    subscription: string
    projectName: string
};

export const ParseEventDelProjectToSubscription = (evt: Event): EventDelProjectToSubscription => {
    const evtEvent: EventDelProjectToSubscription = {
        subscription: '',
        projectName: '',
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'subscription':
                evtEvent[key] = attr.value;
                break
            case 'projectName':
                evtEvent[key] = attr.value;
                break
         }
    })
    return evtEvent;
}