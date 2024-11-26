import { RedisResourceBase } from '../../classes/RedisResourceBase';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProviderMonikerService } from '../global/ProviderMonikerSpecResource';
import { SpecAndConsumerService } from '../global/SpecAndConsumerResource';

export interface AutoCompleteItem {
    id: string;
    name: string;
    type: 'provider' | 'consumer' | 'spec';
    link: string;
    moniker: string;
}

export interface AutoCompleteData {
    data: AutoCompleteItem[];
}

export class AutoCompleteResource extends RedisResourceBase<AutoCompleteData, {}> {
    protected redisKey = 'autocomplete';
    protected ttlSeconds = 600; // 10 minutes cache

    protected async fetchFromDb(): Promise<AutoCompleteData> {
        const baseUrls = {
            providers: ['/provider'],
            consumers: ['/consumer'],
            specs: ['/chain'],
        };

        const providers = ProviderMonikerService.GetAllProviders();
        const consumers = SpecAndConsumerService.GetAllConsumers();
        const specs = SpecAndConsumerService.GetAllSpecs();

        const providerItems = await Promise.all((await providers).flatMap(provider =>
            baseUrls.providers.map(async baseUrl => ({
                id: 'provider-' + provider,
                name: provider,
                type: 'provider' as const,
                link: `${baseUrl}/${provider}`,
                moniker: await ProviderMonikerService.GetMonikerForProvider(provider)
            }))
        ));

        const consumerItems = await Promise.all((await consumers).flatMap(consumer =>
            baseUrls.consumers.map(async baseUrl => ({
                id: 'consumer-' + consumer,
                name: consumer,
                type: 'consumer' as const,
                link: `${baseUrl}/${consumer}`,
                moniker: await ProviderMonikerService.GetMonikerForProvider(consumer)
            }))
        ));

        const specItems = await Promise.all((await specs).flatMap(spec =>
            baseUrls.specs.map(baseUrl => ({
                id: 'spec-' + spec,
                name: spec,
                type: 'spec' as const,
                link: `${baseUrl}/${spec}`,
                moniker: ''
            }))
        ));

        return {
            data: [
                ...providerItems,
                ...consumerItems,
                ...specItems,
            ]
        };
    }
} 