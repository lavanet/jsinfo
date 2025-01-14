import axios from 'axios';
import WebSocket from 'ws';
import { IpRpcEndpointsData } from './IpRpcEndpointsData';
import * as fs from 'fs';
import * as path from 'path';

interface Pattern {
    method: 'GET' | 'POST';
    path?: string;
    body?: any;
}

interface CheckResult {
    status: 'healthy' | 'unhealthy' | 'skipped';
    url: string;
    pattern?: string;
    protocol?: string;
    response_status?: number;
    response_text?: string;
    error?: string;
}

interface ChainResult {
    chain_id: string;
    display_name: string;
    endpoints: Record<string, CheckResult[]>;
}

const PATTERNS: Record<string, Pattern> = {
    'cosmos-blocks': {
        method: 'GET',
        path: '/cosmos/base/tendermint/v1beta1/blocks/latest'
    },
    'eth-block': {
        method: 'POST',
        body: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }
    },
    'near-block': {
        method: 'POST',
        body: { jsonrpc: '2.0', method: 'block', params: { finality: 'final' }, id: 1 }
    },
    'solana-height': {
        method: 'POST',
        body: { jsonrpc: '2.0', method: 'getBlockHeight', params: [], id: 1 }
    },
    'starknet-block': {
        method: 'POST',
        body: { jsonrpc: '2.0', method: 'starknet_blockNumber', params: [], id: 1 }
    },
    'aptos-block': {
        method: 'GET',
        path: '/v1/blocks/by_height/1'
    }
};

async function checkEndpointWithPattern(url: string, patternName: string, pattern: Pattern): Promise<CheckResult> {
    try {
        if (pattern.method === 'GET') {
            const fullUrl = `${url}${pattern.path}`;
            const response = await axios.get(fullUrl);
            if (response.status === 200) {
                console.log(`✅ ${patternName}: ${fullUrl}`);
            }
            return {
                status: response.status === 200 ? 'healthy' : 'unhealthy',
                url,
                pattern: patternName,
                response_status: response.status,
                response_text: response.data?.toString().slice(0, 200),
                error: response.status === 200 ? undefined : `Status ${response.status}`
            };
        } else {
            const response = await axios.post(url, pattern.body);
            if (response.status === 200) {
                console.log(`✅ ${patternName}: ${url}`);
            }
            return {
                status: response.status === 200 ? 'healthy' : 'unhealthy',
                url,
                pattern: patternName,
                response_status: response.status,
                response_text: response.data?.toString().slice(0, 200),
                error: response.status === 200 ? undefined : `Status ${response.status}`
            };
        }
    } catch (e) {
        return {
            status: 'unhealthy',
            url,
            pattern: patternName,
            error: e.message
        };
    }
}

async function checkWebSocket(url: string): Promise<CheckResult> {
    return new Promise((resolve) => {
        const ws = new WebSocket(url, {
            rejectUnauthorized: false,
            timeout: 5000
        });

        const timeout = setTimeout(() => {
            ws.close();
            resolve({
                status: 'unhealthy',
                url,
                protocol: 'websocket',
                error: 'Connection timeout'
            });
        }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            ws.close();
            resolve({
                status: 'healthy',
                url,
                protocol: 'websocket'
            });
        });

        ws.on('error', (error) => {
            clearTimeout(timeout);
            ws.close();
            resolve({
                status: 'unhealthy',
                url,
                protocol: 'websocket',
                error: error.message
            });
        });
    });
}

async function checkEndpoints() {
    console.log(`Checking ${IpRpcEndpointsData.length} chains...`);
    const results: Record<string, ChainResult> = {};

    for (const endpoint of IpRpcEndpointsData) {
        console.log(`\n${endpoint.chainId} (${endpoint.DisplayName})`);
        const chainId = endpoint.chainId;
        results[chainId] = {
            chain_id: chainId,
            display_name: endpoint.DisplayName,
            endpoints: {}
        };

        if (endpoint.apiEndpoints) {
            for (const [protocol, urls] of Object.entries(endpoint.apiEndpoints)) {
                console.log(`\n  Protocol: ${protocol}`);
                if (Array.isArray(urls)) {
                    results[chainId].endpoints[protocol] = [];

                    for (const url of urls) {
                        console.log(`    URL: ${url}`);
                        if (protocol === 'rest' || protocol === 'jsonrpc') {
                            console.log('    Trying all patterns...');
                            // Try all patterns
                            const patternResults = [];
                            for (const [patternName, pattern] of Object.entries(PATTERNS)) {
                                const result = await checkEndpointWithPattern(url, patternName, pattern);
                                if (result.status === 'healthy') {
                                    patternResults.push(result);
                                }
                            }

                            // Store results
                            if (patternResults.length > 0) {
                                (results[chainId].endpoints[protocol] as CheckResult[]).push(...patternResults);
                            } else {
                                const defaultResult = await checkEndpointWithPattern(
                                    url,
                                    'default-get',
                                    { method: 'GET', path: '' }
                                );
                                (results[chainId].endpoints[protocol] as CheckResult[]).push(defaultResult);
                            }
                        } else if (url.includes('websocket')) {
                            const result = await checkWebSocket(url);
                            results[chainId].endpoints[protocol].push(result);
                        }
                        // Note: Removed gRPC checks as they require different handling in TypeScript
                    }
                }
            }
        }
    }

    console.log('\nAll checks completed!');
    return results;
}

async function main() {
    console.log('Main function started');
    try {
        console.log('Starting endpoint checks...');
        const results = await checkEndpoints();
        console.log('Endpoint checks completed');

        const outputPath = path.join(__dirname, 'endpoint_check_results.json');
        console.log('Writing results to:', outputPath);

        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log('Results written to file');

        console.log('\nPrinting results summary:');
        let totalEndpoints = 0;
        let healthyEndpoints = 0;

        for (const [chainId, chainData] of Object.entries(results)) {
            console.log(`\nProcessing results for ${chainId}`);

            for (const [protocol, endpoints] of Object.entries(chainData.endpoints)) {
                console.log(`  Processing ${protocol} endpoints`);
                for (const endpoint of (endpoints as Array<any>)) {
                    totalEndpoints++;
                    if (endpoint.status === 'healthy') healthyEndpoints++;
                }
            }
        }

        console.log('\nFinal Statistics:');
        console.log(`Total endpoints checked: ${totalEndpoints}`);
        console.log(`Healthy endpoints: ${healthyEndpoints}`);
        console.log(`Success rate: ${((healthyEndpoints / totalEndpoints) * 100).toFixed(2)}%`);

    } catch (error) {
        console.error('Error in main:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
    console.log('Script completed successfully');
}

// Add error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
});

console.log('Calling main function...');
main().catch(e => {
    console.error('Top level error:', e);
    process.exit(1);
});
