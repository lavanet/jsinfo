// src/query/classes/SpecAndConsumerCache.ts

import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RedisCache } from './RedisCache';

interface Spec {
    specId: string;
}

interface Consumer {
    consumer: string;
}

class SpecAndConsumerCacheClass {
    private specCache: Spec[] = [];
    private consumerCache: Consumer[] = [];
    private refreshInterval = 2 * 60 * 1000;

    public constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.refreshInterval);
    }

    private async refreshCache() {
        await QueryCheckJsinfoReadDbInstance();

        let newSpecCache = (await RedisCache.getArray("SpecTable") || []) as Spec[];
        let newConsumerCache = (await RedisCache.getArray("ConsumerTable") || []) as Consumer[];

        if ((newSpecCache == null || newSpecCache.length === 0) || (this.specCache.length === 0)) {
            this.specCache = await this.fetchSpecTable();
            RedisCache.setArray("SpecTable", this.specCache, this.refreshInterval);
        } else {
            this.specCache = newSpecCache;
        }

        if ((newConsumerCache == null || newConsumerCache.length === 0) || (this.consumerCache.length === 0)) {
            this.consumerCache = await this.fetchConsumerTable();
            RedisCache.setArray("ConsumerTable", this.consumerCache, this.refreshInterval);
        } else {
            this.consumerCache = newConsumerCache;
        }
    }

    public IsValidSpec(specId: string): boolean {
        specId = specId.toUpperCase();
        return this.specCache.some(item => item.specId === specId);
    }

    public IsValidConsumer(consumer: string): boolean {
        consumer = consumer.toLowerCase();
        return this.consumerCache.some(item => item.consumer === consumer);
    }

    public GetAllSpecs(): string[] {
        return this.specCache.map(spec => spec.specId);
    }

    public GetAllConsumers(): string[] {
        return this.consumerCache.map(consumer => consumer.consumer);
    }

    private async fetchSpecTable(): Promise<Spec[]> {
        const specs = await QueryGetJsinfoReadDbInstance()
            .select({ specId: JsinfoSchema.providerStakes.specId })
            .from(JsinfoSchema.providerStakes)
            .groupBy(JsinfoSchema.providerStakes.specId);

        return specs
            .filter(spec => spec.specId !== null)
            .map(spec => ({ specId: (spec.specId as string).toUpperCase() }));
    }

    private async fetchConsumerTable(): Promise<Consumer[]> {
        const consumers = await QueryGetJsinfoReadDbInstance()
            .select({ consumer: JsinfoSchema.consumerSubscriptionList.consumer })
            .from(JsinfoSchema.consumerSubscriptionList)
            .groupBy(JsinfoSchema.consumerSubscriptionList.consumer);

        return consumers.map(consumer => ({ consumer: consumer.consumer.toLowerCase() }));
    }
}

export const SpecAndConsumerCache = new SpecAndConsumerCacheClass();