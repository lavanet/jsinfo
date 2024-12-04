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
                    const msg = Array.isArray(message) ? message.join(' ') : message;

                    let logMessage = `${timestamp} ${level}: ${TruncateText(msg, 1000)}`;

                    if (metadata.service === 'user-service') {
                        delete metadata.service;
                    }

                    if (Object.keys(metadata).length > 0) {
                        const metadataString = TruncateText(JSONStringify(metadata), 3900);
                        logMessage += ' ' + metadataString;
                    }

                    return TruncateText(logMessage, 5000);
                })
            )
        })
    ]
});

// Extend the logger methods to support multiple arguments
const stringifyArgs = (arg: any): string => {
    // Check for basic types
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
        return String(arg); // Return basic types as strings
    }

    // Handle non-basic types
    if (arg instanceof Map) {
        return JSON.stringify(Object.fromEntries(arg)); // Convert Map to object
    }

    if (arg instanceof Set) {
        return JSON.stringify(Array.from(arg)); // Convert Set to array
    }

    // For other non-basic types, use JSON.stringify
    return JSON.stringify(arg);
};

const formatArgs = (args: any[]) => {
    if (args.length === 0) return '';

    const message = String(args[0]);
    const additionalArgs = args.slice(1).map(arg => stringifyArgs(arg)).join(' ');

    return additionalArgs ? `${message} ${additionalArgs}` : message;
};

const originalInfo = logger.info.bind(logger);
logger.info = (...args: any[]) => {
    const formattedMessage = formatArgs(args);
    originalInfo(formattedMessage);
};

const originalWarn = logger.warn.bind(logger);
logger.warn = (...args: any[]) => {
    const formattedMessage = formatArgs(args);
    originalWarn(formattedMessage);
};

const originalError = logger.error.bind(logger);
logger.error = (...args: any[]) => {
    const formattedMessage = formatArgs(args);
    originalError(formattedMessage);
};






