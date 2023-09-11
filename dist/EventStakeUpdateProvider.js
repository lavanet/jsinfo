"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseEventStakeUpdateProvider = void 0;
const ParseEventStakeUpdateProvider = (evt) => {
    const evtEvent = {
        stakeAppliedBlock: 0,
        stake: 0,
        moniker: '',
        spec: '',
        provider: '',
    };
    evt.attributes.forEach((attr) => {
        let key = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'stakeAppliedBlock':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'stake':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'moniker':
                evtEvent[key] = attr.value;
                break;
            case 'spec':
                evtEvent[key] = attr.value;
                break;
            case 'provider':
                evtEvent[key] = attr.value;
                break;
        }
    });
    return evtEvent;
};
exports.ParseEventStakeUpdateProvider = ParseEventStakeUpdateProvider;
