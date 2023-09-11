"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseEventProviderUnstakeCommit = void 0;
const ParseEventProviderUnstakeCommit = (evt) => {
    const evtEvent = {
        geolocation: 0,
        moniker: '',
        stake: 0,
        address: '',
        chainID: '',
    };
    evt.attributes.forEach((attr) => {
        let key = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'geolocation':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'moniker':
                evtEvent[key] = attr.value;
                break;
            case 'stake':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'address':
                evtEvent[key] = attr.value;
                break;
            case 'chainID':
                evtEvent[key] = attr.value;
                break;
            case 'effectiveImmediately':
        }
    });
    return evtEvent;
};
exports.ParseEventProviderUnstakeCommit = ParseEventProviderUnstakeCommit;
