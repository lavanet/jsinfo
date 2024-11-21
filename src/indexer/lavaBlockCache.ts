import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import * as path from 'path'; // Import path for using path.join
import * as pako from 'pako';
import { JSINFO_INDEXER_CACHE_PATH, JSINFO_INDEXER_CACHE_USE_READ, JSINFO_INDEXER_CACHE_USE_SAVE, JSINFO_INDEXER_CACHE_USE_PAKO_COMPRESSION, JSINFO_INDEXER_CACHE_MAX_SIZE } from './indexerConsts';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';

class LavaBlockCache {
    private cacheSize: number = 0;
    private fileSizes: Map<string, number> = new Map(); // Tracking file sizes

    constructor() {
        this.updateCacheSize();
    }

    private updateCacheSize() {
        const files = readdirSync(JSINFO_INDEXER_CACHE_PATH);
        files.forEach(file => {
            const filePath = path.join(JSINFO_INDEXER_CACHE_PATH, file);
            if (!this.fileSizes.has(file)) {
                const stats = statSync(filePath);
                this.fileSizes.set(file, stats.size);
                this.cacheSize += stats.size;
            }
        });
    }

    private compress(data: string): Buffer {
        const buffer = Buffer.from(data, 'utf-8');
        return Buffer.from(pako.deflate(buffer));
    }

    private decompress(data: Buffer): string {
        const buffer = pako.inflate(data);
        return Buffer.from(buffer).toString('utf-8');
    }

    public async getOrGenerate<T>(height: number, keySuffix: string, generator: () => Promise<T>): Promise<T> {
        const fileName = `${height}_${keySuffix}${JSINFO_INDEXER_CACHE_USE_PAKO_COMPRESSION ? '.pako.json' : '.json'}`;
        const filePath = path.join(JSINFO_INDEXER_CACHE_PATH, fileName);
        if (JSINFO_INDEXER_CACHE_USE_READ && existsSync(filePath)) {
            try {
                let data = readFileSync(filePath);
                if (JSINFO_INDEXER_CACHE_USE_PAKO_COMPRESSION) {
                    data = Buffer.from(this.decompress(data));
                }
                return JSON.parse(data.toString());
            } catch (error) {
                logger.error("Failed to read or parse cache file", error);
            }
        }
        const data = await generator();
        if (JSINFO_INDEXER_CACHE_USE_SAVE) {
            const stringifiedData = JSONStringify(data);
            let writtenData = Buffer.from(stringifiedData, 'utf-8');
            if (JSINFO_INDEXER_CACHE_USE_PAKO_COMPRESSION) {
                const writtenData = this.compress(stringifiedData);
                writeFileSync(filePath, Buffer.from(writtenData));
            } else {
                writeFileSync(filePath, stringifiedData);
            }
            const dataSize = writtenData.length;
            this.cacheSize += dataSize;
            this.fileSizes.set(fileName, dataSize);
            this.manageCacheSize();
        }
        return data;
    }

    private manageCacheSize() {
        while (this.cacheSize > JSINFO_INDEXER_CACHE_MAX_SIZE) {
            const files = Array.from(this.fileSizes.entries())
                .map(([file, size]) => ({
                    file,
                    path: path.join(JSINFO_INDEXER_CACHE_PATH, file),
                    height: parseInt(file.split('_')[0]), // Extract block height from filename
                    size
                }))
                .sort((a, b) => a.height - b.height); // Sort by height

            if (files.length) {
                const oldest = files[0];
                unlinkSync(oldest.path);
                this.cacheSize -= oldest.size;
                this.fileSizes.delete(oldest.file);
            }
        }
    }
}

export default LavaBlockCache;
