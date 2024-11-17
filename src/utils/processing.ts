import { JSONStringify } from "./fmt";
import { logger } from "./logger";

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
