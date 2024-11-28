import { JSONStringify } from '@jsinfo/utils/fmt';
import sizeof from 'object-sizeof';

const MEMORY_THRESHOLD_MB = 1;

interface CacheInfo {
    entries: number;
    size: number;
}

interface MemoryLogOptions {
    className: string;
    caches: Map<string, any>[] | Record<string, any>[];
    cacheNames?: string[];
    threshold?: number;  // in MB
}

export function logClassMemory({
    className,
    caches,
    cacheNames = [],
    threshold = MEMORY_THRESHOLD_MB
}: MemoryLogOptions) {
    const cacheSizes = new Map<string, CacheInfo>();
    let totalSize = 0;

    console.log(`\n=== ${className} Memory Usage ===`);

    // Process each cache
    caches.forEach((cache, index) => {
        const name = cacheNames[index] || `cache${index + 1}`;
        const size = sizeof(cache instanceof Map ? Object.fromEntries(cache) : cache);
        totalSize += size;

        cacheSizes.set(name, {
            entries: cache instanceof Map ? cache.size : Object.keys(cache).length,
            size
        });
    });

    // Only log if total size exceeds threshold
    if (totalSize > threshold * 1024 * 1024) {  // Convert MB to bytes
        const formattedCaches = Object.fromEntries(
            Array.from(cacheSizes.entries())
                .filter(([_, info]) => info.size > threshold * 1024 * 1024)  // Only include caches > 1MB
                .map(([name, info], index) => {
                    const currentCache = caches[index];
                    const cacheData = currentCache instanceof Map ? Object.fromEntries(currentCache) : currentCache;
                    const jsonString = JSONStringify(cacheData);
                    const stringLengthMB = jsonString.length / 1024 / 1024;
                    return [
                        name,
                        {
                            entries: info.entries,
                            size: `${(info.size / 1024 / 1024).toFixed(2)}MB`,
                            ...(stringLengthMB > MEMORY_THRESHOLD_MB && {
                                stringLength: jsonString.length,
                                stringSizeMB: `${stringLengthMB.toFixed(2)}MB`
                            })
                        }
                    ];
                })
        );

        if (Object.keys(formattedCaches).length > 0) {  // Only log if there are caches to report
            console.log({
                timestamp: new Date().toISOString(),
                class: className,
                caches: formattedCaches,
                total: `${(totalSize / 1024 / 1024).toFixed(2)}MB`
            });
        }
    }
}