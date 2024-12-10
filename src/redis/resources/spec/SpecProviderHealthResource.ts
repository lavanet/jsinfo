import { and, desc, eq, gte } from 'drizzle-orm';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface SPHArgs {
    spec: string;
}

export interface SPHRes {
    id: number;
    data: string | null;
    provider: string | null;
    timestamp: Date;
    guid: string | null;
    spec: string;
    geolocation: string | null;
    interface: string | null;
    status: string;
}

export class SpecProviderHealthResource extends RedisResourceBase<SPHRes[], SPHArgs> {
    protected readonly redisKey = 'spec:provider-health';
    protected readonly cacheExpirySeconds = 2 * 60 * 1000; // 2 minutes cache

    protected async fetchFromSource(args: SPHArgs): Promise<SPHRes[]> {
        const { spec } = args;
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const healthRecords: SPHRes[] = await queryJsinfo(db => {
            return db.select()
                .from(JsinfoSchema.providerHealth)
                .where(
                    and(
                        eq(JsinfoSchema.providerHealth.spec, spec),
                        gte(JsinfoSchema.providerHealth.timestamp, twoDaysAgo)
                    )
                )
                .orderBy(desc(JsinfoSchema.providerHealth.timestamp))
                .limit(100);
        }, `SpecProviderHealthResource::fetchFromSource_${spec}`);


        const uniqueRecordsMap = new Map<string, SPHRes>();

        healthRecords.forEach(record => {
            const key = `${record.provider}-${record.spec}`;
            if (!uniqueRecordsMap.has(key) || uniqueRecordsMap.get(key)!.timestamp < record.timestamp) {
                uniqueRecordsMap.set(key, record);
            }
        });

        const uniqueHealthRecords = Array.from(uniqueRecordsMap.values());

        return uniqueHealthRecords;
    }
} 