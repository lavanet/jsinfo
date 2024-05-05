// src/query/classes/CachedDiskPsqlQuery.ts

import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS } from "../queryConsts";
import fs from 'fs';
import { Pagination, ParsePaginationFromRequest } from "../utils/queryPagination";
import { FastifyRequest } from "fastify";

export class CachedDiskPsqlQuery<T> {
    protected cacheDir: string = JSINFO_QUERY_CACHEDIR;
    protected cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS; // 15 minutes in seconds
    protected data: any = null;
    protected data_fetched: boolean = false;
    protected data_fetching: boolean = false;

    protected getCacheFilePath(): string {
        throw new Error("Method 'getCacheFilePath' must be implemented.");
    }

    protected async fetchDataFromDb(): Promise<T[]> {
        throw new Error("Method 'fetchDataFromDb' must be implemented.");
    }

    protected async getPaginatedItemsImpl(data: T[], pagination: Pagination | null): Promise<T[] | null> {
        throw new Error("Method 'getPaginatedItemsImpl' must be implemented.");
    }

    public async getCSVImpl(data: T[]): Promise<string> {
        throw new Error("Method 'getCSVImpl' must be implemented.");
    }

    private lockExists(): boolean {
        const lockFilePath = this.getCacheFilePath() + ".lock";
        return fs.existsSync(lockFilePath);
    }

    private lockIsFresh(): boolean {
        const lockFilePath = this.getCacheFilePath() + ".lock";
        const stats = fs.statSync(lockFilePath);
        const ageInSeconds = (Date.now() - stats.birthtime.getTime()) / 1000;
        return ageInSeconds <= 60;
    }

    private createLock(): void {
        const lockFilePath = this.getCacheFilePath() + ".lock";
        fs.writeFileSync(lockFilePath, '');
    }

    private deleteLock(): void {
        const lockFilePath = this.getCacheFilePath() + ".lock";
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
        }
    }

    protected async runBgFetch() {
        if (this.data_fetching) return;
        if (this.lockExists() && this.lockIsFresh()) return null;
        this.createLock();
        this.data_fetching = true;
        if (!this.data_fetched || this.didDataExpire()) {
            setImmediate(async () => {
                try {
                    const data = await this.fetchDataFromDb();
                    const cacheFilePath = this.getCacheFilePath();
                    fs.writeFileSync(cacheFilePath, JSON.stringify(data));
                    this.data_fetched = true;
                    this.data = data;
                } catch (e) {
                    console.error("CachedDiskPsqlQuery Error:", this.getCacheFilePath(), e);
                }
                this.data_fetching = false;
                this.deleteLock();
            });
        }
    }

    protected didDataExpire(): boolean {
        const cacheFilePath = this.getCacheFilePath();
        if (JSINFO_QUERY_CACHE_ENABLED && fs.existsSync(cacheFilePath)) {
            const stats = fs.statSync(cacheFilePath);
            const ageInSeconds = (Date.now() - stats.mtime.getTime()) / 1000;
            if (ageInSeconds <= this.cacheAgeLimit) {
                return true;
            }
        }
        return false;
    }

    protected async fetchDataFromCache(): Promise<T[] | null> {
        this.runBgFetch();
        if (!this.data_fetched) return null;
        return this.data;
    }

    public async getTotalItemCount(): Promise<{ itemCount: number } | {}> {
        try {
            const data = await this.fetchDataFromCache();
            if (data == null) return {};
            return { itemCount: data.length };
        } catch (error) {
            console.error('Error getting total item count:', error);
            return {};
        }
    }

    public async getPaginatedItems(request: FastifyRequest): Promise<{ data: T[] } | null> {
        const data = await this.fetchDataFromCache();
        if (data == null) return null;
        let pagination = ParsePaginationFromRequest(request)
        let paginatedData = await this.getPaginatedItemsImpl(data, pagination);
        if (paginatedData == null) return null;
        return { data: paginatedData };
    }

    public async getCSV(): Promise<string | null> {
        const data = await this.fetchDataFromCache();
        if (data == null) return null;
        let csv = await this.getCSVImpl(data);
        if (csv == null) return null;
        return csv;
    }
}
