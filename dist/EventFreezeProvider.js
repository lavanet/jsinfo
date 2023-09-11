"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseEventFreezeProvider = void 0;
const ParseEventFreezeProvider = (evt) => {
    const evtEvent = {
        providerAddress: '',
        freezeReason: '',
        chainIDs: [],
        freezeRequestBlock: 0,
    };
    evt.attributes.forEach((attr) => {
        let key = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'providerAddress':
                evtEvent[key] = attr.value;
                break;
            case 'freezeReason':
                evtEvent[key] = attr.value;
                break;
            case 'chainIDs':
                evtEvent[key] = attr.value.split(',');
                break;
            case 'freezeRequestBlock':
                evtEvent[key] = parseInt(attr.value);
                break;
        }
    });
    return evtEvent;
};
exports.ParseEventFreezeProvider = ParseEventFreezeProvider;
