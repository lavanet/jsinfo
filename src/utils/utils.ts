
import retry from 'async-retry';
import util from 'util';

export function GetEnvVar(key: string, alt?: string): string {
    const value = process.env[key];
    if (!value) {
        if (alt !== undefined) {
            return alt;
        }
        throw new Error(`${key} environment variable is not set or is an empty string`);
    }
    return value;
}

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
                winston.format.printf(({ level, message, label, timestamp }) => {
                    return `${timestamp} ${level}: ${message}`;
                })
            )
        })
    ]
});

// Define the BackoffRetry function
export const BackoffRetry = async <T>(title: string, fn: () => Promise<T>): Promise<T> => {
    return await retry(fn,
        {
            retries: 8, // The maximum amount of times to retry the operation
            factor: 2,  // The exponential factor to use
            minTimeout: 1000, // The number of milliseconds before starting the first retry
            maxTimeout: 5000, // The maximum number of milliseconds between two retries
            randomize: true, // Randomizes the timeouts by multiplying with a factor between 1 to 2
            onRetry: (error: any, attempt: any) => {
                let errorMessage = `[Backoff Retry] Function: ${title}\n`;
                try {
                    errorMessage += `Attempt number: ${attempt} has failed.\n`;
                    if (error instanceof Error) {
                        errorMessage += `An error occurred during the execution of ${title}: ${error.message}\n`;
                        errorMessage += `Stack trace for the error in ${title}: ${error.stack}\n`;
                        errorMessage += `Full error object: ${util.inspect(error, { showHidden: true, depth: null })}\n`;
                    } else {
                        errorMessage += `An unknown error occurred during the execution of ${title}: ${error}\n`;
                    }
                } catch (e) { }
                logger.error(errorMessage);
            }
        }
    );
};

export function Sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let cachedPostgresUrl: string | null = null;

export async function GetPostgresUrl(): Promise<string> {
    if (cachedPostgresUrl !== null) {
        return cachedPostgresUrl;
    }
    try {
        cachedPostgresUrl = GetEnvVar("JSINFO_POSTGRESQL_URL");
    } catch (error) {
        try {
            cachedPostgresUrl = GetEnvVar("POSTGRESQL_URL");
        } catch (error) {
            logger.error("Missing env var for POSTGRESQL_URL or JSINFO_POSTGRESQL_URL");
            await Sleep(60000); // Sleep for one minute
            process.exit(1);
        }
    }
    return cachedPostgresUrl!;
}

export async function DoInChunks(size: number, arr: any[], callback: (arr: any[]) => Promise<any>) {
    while (arr.length != 0) {
        const tmpArr = arr.splice(0, size);
        try {
            await callback(tmpArr);
        } catch (error) {
            logger.error(`Error processing chunk: ${JSONStringify(tmpArr)}`);
            logger.error(`Callback function: ${callback.toString()}`);
            if (error instanceof Error) {
                logger.error(`Error message: ${error.message}`);
                logger.error(`Stack Trace: ${error.stack}`);
            }
            throw error;
        }
    }
    return;
}

export function MinBigInt(a: bigint | null, b: bigint | null): bigint {
    let aValue = a ?? 0n;
    let bValue = b ?? 0n;
    return aValue < bValue ? aValue : bValue;
}

export function BigIntIsZero(value: bigint | null): boolean {
    return value === null ? false : value === 0n;
}

export function ParseUlavaToBigInt(value: string): bigint {
    const claimedParts = value.split(',');

    // Iterate over each value to find 'ulava'
    let ulavaValue = '';
    for (const part of claimedParts) {
        if (part.includes('ulava')) {
            ulavaValue = part;
            break;
        }
    }

    if (ulavaValue === '') return 0n;

    const ulavaIndex = ulavaValue.indexOf('ulava');
    if (ulavaIndex === -1) {
        throw new Error(`ParseUlavaToBigInt: Value does not contain 'ulava': ${value}, ulavaValue: ${ulavaValue}`);
    }

    const numberPart = ulavaValue.substring(0, ulavaIndex);

    // Check if the string only contains numeric characters
    if (!/^\d+$/.test(numberPart)) {
        throw new Error(`ParseUlavaToBigInt: value is not a valid integer: ${value}, numberPart: ${numberPart}`);
    }

    return BigInt(numberPart);
}

export function JSONStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    );
}

export function JSONStringifySpaced(obj: any): string {
    return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2
    );
}