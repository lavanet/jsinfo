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
    protected readonly cacheExpirySeconds = 2 * 60; // 2 minutes cache (in seconds)

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
            // Skip records without provider
            if (!record.provider) return;
            
            const key = `${record.provider}-${record.spec}-${record.interface || 'unknown'}`;
            const existing = uniqueRecordsMap.get(key);
            
            // Prefer healthy status over any other status
            // If no existing record, or this record is healthy, or (existing is not healthy and this is newer)
            if (!existing) {
                uniqueRecordsMap.set(key, record);
            } else if (record.status === 'healthy' && existing.status !== 'healthy') {
                // Always prefer healthy over unhealthy, regardless of timestamp
                uniqueRecordsMap.set(key, record);
            } else if (existing.status !== 'healthy' && record.status !== 'healthy' && record.timestamp > existing.timestamp) {
                // If both are unhealthy, prefer newer timestamp
                uniqueRecordsMap.set(key, record);
            } else if (existing.status === 'healthy' && record.status === 'healthy' && record.timestamp > existing.timestamp) {
                // If both are healthy, prefer newer timestamp
                uniqueRecordsMap.set(key, record);
            }
            // Otherwise keep existing record
        });

        const uniqueHealthRecords = Array.from(uniqueRecordsMap.values());

        return uniqueHealthRecords;
    }
} 