"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseEventStakeNewProvider = void 0;
const ParseEventStakeNewProvider = (evt) => {
    const evtEvent = {
        spec: '',
        provider: '',
        stakeAppliedBlock: 0,
        stake: 0,
        geolocation: 0,
        effectiveImmediately: false,
        moniker: '',
    };
    evt.attributes.forEach((attr) => {
        let key = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'spec':
                evtEvent[key] = attr.value;
                break;
            case 'provider':
                evtEvent[key] = attr.value;
                break;
            case 'stakeAppliedBlock':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'stake':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'geolocation':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'effectiveImmediately':
                evtEvent[key] = attr.value == 'false' ? false : true;
                break;
            case 'moniker':
                evtEvent[key] = attr.value;
                break;
        }
    });
    return evtEvent;
};
exports.ParseEventStakeNewProvider = ParseEventStakeNewProvider;
