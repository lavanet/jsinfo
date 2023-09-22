import { Event } from "@cosmjs/stargate"
/*
341737  {
  type: 'lava_add_project_to_subscription_event',
  attributes: [
    {
      key: 'subscription',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    { key: 'projectName', value: 'f195d68175eb091ec1f71d00f8952b85' }
  ]
}
*/
export type EventAddProjectToSubscription = {
    subscription: string
    projectName: string
};

export const ParseEventAddProjectToSubscription = (evt: Event): EventAddProjectToSubscription => {
    const evtEvent: EventAddProjectToSubscription = {
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