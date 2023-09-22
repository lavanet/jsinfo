import { Event } from "@cosmjs/stargate"
/*
360227  {
  type: 'lava_buy_subscription_event',
  attributes: [
    {
      key: 'consumer',
      value: 'lava@1zw9r5rrslceh5c6pkxy73lrsnr2a7ntdt36gxc'
    },
    { key: 'duration', value: '6' },
    { key: 'plan', value: 'whale' }
  ]
}
*/
export type EventBuySubscription = {
    consumer: string
    duration: number
    plan: string
};

export const ParseEventBuySubscription = (evt: Event): EventBuySubscription => {
    const evtEvent: EventBuySubscription = {
        consumer: '',
        duration: 0,
        plan: '',
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'consumer':
                evtEvent[key] = attr.value;
                break
            case 'duration':
                evtEvent[key] = parseInt(attr.value);
                break
            case 'plan':
                evtEvent[key] = attr.value;
                break
         }
    })
    return evtEvent;
}