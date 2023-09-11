"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseEventRelayPayment = void 0;
const ParseEventRelayPayment = (evt) => {
    const evtEvent = {
        relayNumber: 0,
        uniqueIdentifier: 0,
        ExcellenceQoSAvailability: 0,
        //clientFee: 0,
        provider: '',
        chainID: '',
        QoSSync: 0,
        ExcellenceQoSLatency: 0,
        reliabilityPay: false,
        QoSScore: 0,
        CU: 0,
        ExcellenceQoSSync: 0,
        client: '',
        badge: '',
        Mint: 0,
        BasePay: 0,
        totalCUInEpoch: 0,
        QoSLatency: 0,
        QoSAvailability: 0,
        projectID: '',
        descriptionString: '',
        QoSReport: '',
    };
    evt.attributes.forEach((attr) => {
        let key = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'relayNumber':
                evtEvent[key] = parseFloat(attr.value);
                break;
            case 'uniqueIdentifier':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'ExcellenceQoSAvailability':
                evtEvent[key] = parseFloat(attr.value);
                break;
            /*case 'clientFee':
              break;*/
            case 'provider':
                evtEvent[key] = attr.value;
                break;
            case 'chainID':
                evtEvent[key] = attr.value;
                break;
            case 'QoSSync':
                evtEvent[key] = parseFloat(attr.value);
                break;
            case 'ExcellenceQoSLatency':
                evtEvent[key] = parseFloat(attr.value);
                break;
            case 'reliabilityPay':
                attr.value == 'false' ? false : true;
                break;
            case 'QoSScore':
                evtEvent[key] = parseFloat(attr.value);
                break;
            case 'CU':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'ExcellenceQoSSync':
                evtEvent[key] = parseFloat(attr.value);
                break;
            case 'client':
                evtEvent[key] = attr.value;
                break;
            case 'badge':
                if (attr.value.length == 2) {
                    break;
                }
                let s = attr.value.substring(1, attr.value.length - 2);
                let sT = s.split(' ');
                let res = '0x';
                for (var i = 0; i < sT.length; i++) {
                    let h = parseInt(sT[i]).toString(16);
                    res += h.length % 2 ? '0' + h : h;
                }
                evtEvent[key] = res;
                break;
            case 'Mint':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'BasePay':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'totalCUInEpoch':
                evtEvent[key] = parseInt(attr.value);
                break;
            case 'QoSLatency':
                evtEvent[key] = parseFloat(attr.value);
                break;
            case 'QoSAvailability':
                evtEvent[key] = parseFloat(attr.value);
                break;
            case 'projectID':
                evtEvent[key] = attr.value;
                break;
            case 'descriptionString':
                evtEvent[key] = attr.value;
                break;
            case 'QoSReport':
                evtEvent[key] = attr.value;
                break;
        }
    });
    return evtEvent;
};
exports.ParseEventRelayPayment = ParseEventRelayPayment;
