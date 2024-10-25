import axios from 'axios';
import { GetEnvVar, logger, BackoffRetry, TruncateError } from "../utils/utils";

export async function QueryLavaRPC<T>(path: string): Promise<T> {
    const baseUrl = GetEnvVar("JSINFO_INDEXER_LAVA_REST_RPC_URL");
    const url = `${baseUrl}${path}`;

    return BackoffRetry(`QueryLavaRPC: ${path}`, async () => {
        try {
            const response = await axios.get<T>(url);
            return response.data;
        } catch (error) {
            logger.error(`Failed to fetch data from ${url}`, { error: TruncateError(error) });
            throw error;
        }
    });
}
