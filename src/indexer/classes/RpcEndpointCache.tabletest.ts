import { RpcEndpointCache } from './RpcEndpointCache';

async function printProviderDelegationsTable() {
    console.log("\nProvider Delegations Data:");
    console.log("==========================");

    console.log("Provider\tDelegator\tAmount\tTimestamp\tIs From Empty Provider");
    console.log("-".repeat(100));

    const providers = await RpcEndpointCache.GetProviders();
    console.log(`Retrieved ${providers.length} providers`);

    if (providers.length === 0) {
        console.error("No providers found. Exiting.");
        return;
    }

    const delegatorData = new Map<string, { amount: bigint, timestamp: string, isFromEmptyProvider: boolean }>();

    // Fetch empty provider delegations
    const emptyProviderDelegations = await RpcEndpointCache.GetProviderDelegators('empty_provider');
    for (const delegation of emptyProviderDelegations.delegations || []) {
        delegatorData.set(delegation.delegator, {
            amount: BigInt(delegation.amount.amount),
            timestamp: delegation.timestamp,
            isFromEmptyProvider: true
        });
    }

    for (const provider of providers) {
        try {
            const delegatorsResponse = await RpcEndpointCache.GetProviderDelegators(provider);

            if (delegatorsResponse.delegations && delegatorsResponse.delegations.length > 0) {
                for (const delegation of delegatorsResponse.delegations) {
                    const isFromEmptyProvider = delegatorData.get(delegation.delegator)?.isFromEmptyProvider || false;
                    console.log(`${provider}\t${delegation.delegator}\t${delegation.amount.amount} <${delegation.amount.denom}>\t${delegation.timestamp}\t${isFromEmptyProvider}`);

                    // Update delegator data
                    const existingData = delegatorData.get(delegation.delegator);
                    if (existingData) {
                        existingData.amount += BigInt(delegation.amount.amount);
                    } else {
                        delegatorData.set(delegation.delegator, {
                            amount: BigInt(delegation.amount.amount),
                            timestamp: delegation.timestamp,
                            isFromEmptyProvider: false
                        });
                    }
                }
            } else {
                console.log(`${provider}\tNo delegations found\t-\t-\t-`);
            }
        } catch (error) {
            console.error(`Error processing provider ${provider}:`, error);
        }
    }

    // Print Delegator-Timestamp table
    console.log("\nDelegator-Timestamp Table:");
    console.log("===========================");
    console.log("Delegator\tAmount\tTimestamp\tIs From Empty Provider");
    console.log("-".repeat(100));

    for (const [delegator, data] of delegatorData.entries()) {
        console.log(`${delegator}\t${data.amount.toString()} <ulava>\t${data.timestamp}\t${data.isFromEmptyProvider}`);
    }

    // Print total delegated amount
    try {
        const totalDelegated = await RpcEndpointCache.GetTotalDelegatedAmount();
        console.log("\nTotal Delegated Amount:");
        console.log("=======================");
        console.log(`${totalDelegated.toString()} <ulava>`);
    } catch (error) {
        console.error("Error fetching total delegated amount:", error);
    }
}

// Run the function
printProviderDelegationsTable().catch(console.error);
