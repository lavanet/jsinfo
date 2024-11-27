import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';
import { gt, sql } from 'drizzle-orm';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { EstimatedRewardsResponse } from '@jsinfo/indexer/classes/RpcOnDemandEndpointCache';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import { ConvertToBaseDenom } from '@jsinfo/indexer/restrpc_agregators/CurrencyConverstionUtils';

interface AllAprProviderData {
    address: string;
    moniker: string;
    apr?: string | null;
    commission?: string | null;
    '30_days_cu_served'?: string | null;
    rewards: EstimatedRewardsResponse;
}

// Helper function to get commission
function ValueOrDash(provider: string | undefined): string {
    return IsMeaningfulText("" + provider) ? String(provider) : '-';
}

function formatToFourDecimals(value: number): string {
    const formattedToFour = value.toFixed(4);
    if (formattedToFour === '0.0000') {
        const formattedToTen = value.toFixed(10);
        if (formattedToTen === '0.0000000000') return '0';
        return formattedToTen;
    }
    return formattedToFour;
}

function formatToPercent(value: number): string {
    if (!IsMeaningfulText("" + value)) return '-'; // Return '-' if the value is not a number
    return (value * 100).toFixed(4) + '%'; // Convert to percentage and format to one decimal place
}

// Helper function to safely format commission
function formatCommissionPrecent(commission: any): string {
    if (!IsMeaningfulText(commission)) return '-';
    let commission_float = parseFloat(commission);
    if (commission_float === 0) return '0.0%';
    return commission_float.toFixed(1) + "%";
}

interface AddressAndApr {
    address: string;
    type: string;
    apr: string; // or number, depending on your use case
    rewards: EstimatedRewardsResponse; // Assuming this is already defined
}

interface ProviderCommission {
    provider: string;
    commission: number; // Assuming commission is a number
}

interface CuServed {
    provider: string;
    cuSum: number; // Assuming cuSum is a number
    relaySum: number; // Assuming relaySum is a number
}

export class AllProviderAPRResource extends RedisResourceBase<AllAprProviderData[], {}> {
    protected readonly redisKey = 'allProviderAPR';
    protected readonly ttlSeconds = 300; // 5 minutes cache

    protected async fetchFromDb(): Promise<AllAprProviderData[]> {
        const result = await queryJsinfo(async (db) => {
            const [addressAndAprData, providerCommissionsData, cuServedData] = await this.fetchData(db);
            const providerCommissionsDataMapByProviderId = this.mapProviderCommissions(providerCommissionsData);
            const cuServedDataMapByProviderId = this.mapCuServedData(cuServedData);

            const { addressAndAprDataRestakingById, addressAndAprDataStackingById, addressAndAprDataRewardsById } =
                await this.processAddressAndAprData(addressAndAprData);

            this.calculateAverages(addressAndAprDataRestakingById);
            this.calculateAverages(addressAndAprDataStackingById);

            return this.constructProcessedData(addressAndAprDataRestakingById, addressAndAprDataStackingById,
                providerCommissionsDataMapByProviderId, cuServedDataMapByProviderId, addressAndAprDataRewardsById);
        }, `ProviderAPRResource::fetchFromDb`);

        return result;
    }

    private async fetchData(db: any): Promise<[AddressAndApr[], ProviderCommission[], CuServed[]]> {
        const addressAndApr = db.select({
            address: JsinfoSchema.aprPerProvider.provider,
            type: JsinfoSchema.aprPerProvider.type,
            apr: JsinfoSchema.aprPerProvider.value,
            rewards: sql`${JsinfoSchema.aprPerProvider.estimatedRewards}`
        }).from(JsinfoSchema.aprPerProvider)
            .where(gt(JsinfoSchema.aprPerProvider.timestamp, sql<Date>`now() - interval '30 day'`));

        const providerCommissions = db.select({
            provider: JsinfoSchema.providerStakes.provider,
            commission: sql`AVG(CASE WHEN ${JsinfoSchema.providerStakes.delegateCommission} IS NOT NULL AND ${JsinfoSchema.providerStakes.delegateCommission} > 0 THEN ${JsinfoSchema.providerStakes.delegateCommission} END)`
        }).from(JsinfoSchema.providerStakes)
            .groupBy(JsinfoSchema.providerStakes.provider);

        const cuServed = db.select({
            provider: JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
            cuSum: sql`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum: sql`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider)
            .where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`));

        return Promise.all([addressAndApr, providerCommissions, cuServed]);
    }

    private mapProviderCommissions(providerCommissionsData: any[]): Record<string, string> {
        return Object.fromEntries(
            providerCommissionsData
                .filter(curr => IsMeaningfulText(curr.provider) && curr.provider !== null)
                .map(curr => [curr.provider!.toLowerCase().trim(), formatCommissionPrecent(curr.commission)])
        );
    }

    private mapCuServedData(cuServedData: CuServed[]): Record<string, number> {
        const cuServedDataMapByProviderId: Record<string, number> = {};
        for (const curr of cuServedData) {
            if (!IsMeaningfulText(curr.provider) || curr.provider === null) continue;
            const provider = curr.provider!.toLowerCase().trim();
            if (!cuServedDataMapByProviderId[provider]) {
                cuServedDataMapByProviderId[provider] = 0; // Initialize if not present
            }
            cuServedDataMapByProviderId[provider] += parseInt("" + curr.cuSum); // Sum cuSum for the same provider
        }
        return cuServedDataMapByProviderId;
    }

    private async processAddressAndAprData(addressAndAprData: AddressAndApr[]): Promise<any> {
        const addressAndAprDataRestakingById: Record<string, any> = {};
        const addressAndAprDataStackingById: Record<string, any> = {};
        const addressAndAprDataRewardsById: Record<string, any> = {};

        for (const curr of addressAndAprData) {
            if (IsMeaningfulText(curr.address) && curr.address !== null) {
                const address = curr.address.toLowerCase().trim();

                addressAndAprDataRewardsById[address] = curr.rewards;

                if (typeof addressAndAprDataRewardsById[address] === 'string') {
                    addressAndAprDataRewardsById[address] = JSON.parse(addressAndAprDataRewardsById[address]);
                }

                if (addressAndAprDataRewardsById[address]) {
                    if (addressAndAprDataRewardsById[address].info.length == 0 &&
                        addressAndAprDataRewardsById[address].total.length == 0) {
                        addressAndAprDataRewardsById[address] = null;
                    }
                }

                if (addressAndAprDataRewardsById[address]) {
                    addressAndAprDataRewardsById[address].info = await this.processRewards(addressAndAprDataRewardsById[address].info);
                    addressAndAprDataRewardsById[address].total = await this.processRewards(addressAndAprDataRewardsById[address].total, true);
                }

                if (addressAndAprDataRewardsById[address]) {
                    if (addressAndAprDataRewardsById[address].total.length != 0) {
                        delete addressAndAprDataRewardsById[address].info;
                        addressAndAprDataRewardsById[address] = addressAndAprDataRewardsById[address].total;
                    } else {
                        delete addressAndAprDataRewardsById[address].total;
                        addressAndAprDataRewardsById[address] = addressAndAprDataRewardsById[address].info;
                    }
                }

                if (curr.type.toLowerCase().trim() === 'restaking') {
                    if (!addressAndAprDataRestakingById[address]) {
                        addressAndAprDataRestakingById[address] = []; // Initialize as an empty array if not present
                    }
                    addressAndAprDataRestakingById[address].push(curr.apr); // Store the APR in the array
                } else if (curr.type.toLowerCase().trim() in ['stacking', 'staking']) {
                    if (!addressAndAprDataStackingById[address]) {
                        addressAndAprDataStackingById[address] = []; // Initialize as an empty array if not present
                    }
                    addressAndAprDataStackingById[address].push(curr.apr); // Store the APR in the array
                }
            }
        }

        return { addressAndAprDataRestakingById, addressAndAprDataStackingById, addressAndAprDataRewardsById };
    }

    private async processRewards(rewards: any[], isTotal: boolean = false): Promise<any[]> {
        const processedRewards: any[] = []; // Array to hold processed rewards
        for (const x of rewards) {
            try {
                const [amount, denom] = await ConvertToBaseDenom(isTotal ? x.amount + "" : x.amount.amount + "", isTotal ? x.denom + "" : x.amount.denom + "");
                if (isTotal) {
                    x.amount = amount;
                    x.denom = denom;
                    x.source = x?.source?.toLowerCase().trim();
                } else {
                    x.amount.amount = amount;
                    x.amount.denom = denom;
                    x.source = x?.source?.toLowerCase().trim();
                }
                processedRewards.push(x); // Add processed reward to the array
            } catch (error) {
                console.error('Error processing reward item:', x, error);
                // Handle the error as needed (e.g., set default values or skip)
            }
        }
        return processedRewards; // Return the processed rewards
    }

    private calculateAverages(dataMap: Record<string, any>): void {
        for (const address of Object.keys(dataMap)) {
            const total = dataMap[address].reduce((a, b) => a + b, 0);
            const count = dataMap[address].length;
            const average = count > 0 ? (total / count) : 0; // Calculate average or set to 0
            dataMap[address] = formatToPercent(average); // Use the helper function to format the average
        }
    }

    private async constructProcessedData(
        addressAndAprDataRestakingById: Record<string, any>,
        addressAndAprDataStackingById: Record<string, any>,
        providerCommissionsDataMapByProviderId: Record<string, string>,
        cuServedDataMapByProviderId: Record<string, number>,
        addressAndAprDataRewardsById: Record<string, any>
    ): Promise<AllAprProviderData[]> {
        const processedAddressAndAprData: AllAprProviderData[] = [];
        const entries = new Set<string>(Object.keys(addressAndAprDataRestakingById));

        for (const address of entries) {
            const moniker = await ProviderMonikerService.GetMonikerForProvider(address);
            const ret: AllAprProviderData = {
                address: address,
                moniker: ValueOrDash(moniker),
                apr: ValueOrDash(String(addressAndAprDataRestakingById[address])),
                // stacking_apr: ValueOrDash(String(addressAndAprDataStackingById[address])),
                commission: formatCommissionPrecent(providerCommissionsDataMapByProviderId[address]),
                '30_days_cu_served': ValueOrDash(String(cuServedDataMapByProviderId[address])),
                rewards: addressAndAprDataRewardsById[address] || "-",
            };
            processedAddressAndAprData.push(ret);
        }

        return processedAddressAndAprData;
    }
}