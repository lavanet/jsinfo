import { FetchRestData } from "./RestFetch";

export const LAVA_RPC_MAINNET_URL = "https://lava.rest.lava.build/"

export async function QueryLavaMainnetRPC<T>(path: string): Promise<T> {
    if (LAVA_RPC_MAINNET_URL.endsWith('/') && path.startsWith('/')) {
        path = path.slice(1);
    }
    const url = `${LAVA_RPC_MAINNET_URL}${path}`;
    return FetchRestData<T>(url);
}
