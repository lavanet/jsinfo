import retry from 'async-retry';
import util from 'util';
import { logger } from './logger';
import { TruncateError } from './fmt';

// Define the BackoffRetry function
export const BackoffRetry = async <T>(
    title: string,
    fn: () => Promise<T>,
    retries: number = 8,
    factor: number = 2,
    minTimeout: number = 1000,
    maxTimeout: number = 5000
): Promise<T> => {
    return await retry(fn,
        {
            retries: retries, // The maximum amount of times to retry the operation
            factor: factor,  // The exponential factor to use
            minTimeout: minTimeout, // The number of milliseconds before starting the first retry
            maxTimeout: maxTimeout, // The maximum number of milliseconds between two retries
            randomize: true, // Randomizes the timeouts by multiplying with a factor between 1 to 2
            onRetry: (error: any, attempt: any) => {
                if (!(error instanceof Error) || !error.message.includes('429')) {
                    logger.error(
                        `[${title}] Attempt ${attempt}/${retries} failed: ${error instanceof Error ? error.message : String(error)}`
                    );
                    throw error;
                }
                let errorMessage = `[Backoff Retry] Function: ${title}\n`;
                try {
                    errorMessage += `Attempt number: ${attempt} has failed.\n`;
                    if (error instanceof Error) {
                        errorMessage += `An error occurred during the execution of ${title}: ${TruncateError(error.message)}\n`;
                        errorMessage += `Stack trace for the error in ${title}: ${TruncateError(error.stack)}\n`;
                        errorMessage += `Full error object: ${TruncateError(util.inspect(error, { showHidden: true, depth: null }))}\n`;
                    } else {
                        errorMessage += `An unknown error occurred during the execution of ${title}: ${TruncateError(String(error))}\n`;
                    }
                } catch (e) { }
                logger.error(errorMessage);
            }
        }
    );
};
