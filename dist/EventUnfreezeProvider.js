"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseEventUnfreezeProvider = void 0;
const ParseEventUnfreezeProvider = (evt) => {
    const evtEvent = {
        providerAddress: '',
        chainIDs: [],
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
            case 'chainIDs':
                evtEvent[key] = attr.value.split(',');
                break;
        }
    });
    return evtEvent;
};
exports.ParseEventUnfreezeProvider = ParseEventUnfreezeProvider;
