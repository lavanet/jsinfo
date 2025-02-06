import { GetEnvVar } from "@jsinfo/utils/env";
import { FetchRestData } from "./RestFetch";

const LavaRPCBaseUrl = (() => {
    const url = GetEnvVar("JSINFO_INDEXER_LAVA_REST_RPC_URL", "") || GetEnvVar("JSINFO_LAVA_REST_RPC_URL", "");
    if (!url) {
        throw new Error("QueryLavaRPC: No base URL found");
    }
    return url;
})();

export async function QueryLavaRPC<T>(path: string): Promise<T> {
    if (LavaRPCBaseUrl.endsWith('/') && path.startsWith('/')) {
        path = path.slice(1);
    }
    const url = `${LavaRPCBaseUrl}${path}`;
    return FetchRestData<T>(url);
}
