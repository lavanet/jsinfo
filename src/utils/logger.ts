import { TruncateText, JSONStringify } from "./fmt";

const winston = require('winston');

export const logger = winston.createLogger({
    level: 'silly',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ all: true }),
                winston.format.printf(({ level, message, timestamp, service, ...metadata }) => {
                    let msg = `${timestamp} ${level}: ${TruncateText(message, 1000)}`;

                    if (metadata.service === 'user-service') {
                        delete metadata.service;
                    }

                    if (Object.keys(metadata).length > 0) {
                        const metadataString = TruncateText(JSONStringify(metadata), 3900);
                        msg += ' ' + metadataString;
                    }

                    return TruncateText(msg, 5000);
                })
            )
        })
    ]
});






