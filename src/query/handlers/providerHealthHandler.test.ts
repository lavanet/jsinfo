import {
    HealthReport, ApplyHealthResponseGroupingAndTextFormatting,
    CompareHealthReportByStatusLatency, RoundDateToNearest15Minutes, GroupHealthReportBy15MinutesWithSort
} from './providerHealthHandler';

export const createHealthReport = (partialReport: Partial<HealthReport>): HealthReport => {
    return {
        message: null,
        block: null,
        latency: null,
        status: '',
        blocksaway: null,
        timestamp: new Date(),
        id: 0,
        provider: null,
        spec: '',
        interface: null,
        ...partialReport,
    };
};

describe('CompareHealthReportByStatusLatency', () => {
    test('should prioritize frozen over unhealthy and healthy', () => {
        const frozenReport = createHealthReport({ status: 'frozen', latency: null, block: null, blocksaway: null, message: null });
        const unhealthyReport = createHealthReport({ status: 'unhealthy', latency: null, block: null, blocksaway: null, message: null });
        expect(CompareHealthReportByStatusLatency(frozenReport, unhealthyReport)).toBeLessThan(0);
        expect(CompareHealthReportByStatusLatency(unhealthyReport, frozenReport)).toBeGreaterThan(0);
    });

    test('should prioritize unhealthy over healthy', () => {
        const unhealthyReport = createHealthReport({ status: 'unhealthy', latency: null, block: null, blocksaway: null, message: null });
        const healthyReport = createHealthReport({ status: 'healthy', latency: null, block: null, blocksaway: null, message: null });
        expect(CompareHealthReportByStatusLatency(unhealthyReport, healthyReport)).toBeLessThan(0);
        expect(CompareHealthReportByStatusLatency(healthyReport, unhealthyReport)).toBeGreaterThan(0);
    });

    test('should compare based on latency when statuses are equal', () => {
        const reportA = createHealthReport({ status: 'healthy', latency: 100, block: null, blocksaway: null, message: null });
        const reportB = createHealthReport({ status: 'healthy', latency: 200, block: null, blocksaway: null, message: null });
        expect(CompareHealthReportByStatusLatency(reportA, reportB)).toBeLessThan(0);
        expect(CompareHealthReportByStatusLatency(reportB, reportA)).toBeGreaterThan(0);
    });

    test('should compare based on block and blocksaway when statuses and latencies are equal', () => {
        const reportA = createHealthReport({ status: 'healthy', latency: 100, block: 5, blocksaway: 10, message: null });
        const reportB = createHealthReport({ status: 'healthy', latency: 100, block: 6, blocksaway: 9, message: null }); // Latest block is 15 for both
        expect(CompareHealthReportByStatusLatency(reportA, reportB)).toBe(0);
    });

    test('should compare based on message when all other attributes are equal', () => {
        const reportA = createHealthReport({ status: 'healthy', latency: 100, block: 5, blocksaway: 10, message: "A" });
        const reportB = createHealthReport({ status: 'healthy', latency: 100, block: 5, blocksaway: 10, message: "B" });
        expect(CompareHealthReportByStatusLatency(reportA, reportB)).toBeLessThan(0);
        expect(CompareHealthReportByStatusLatency(reportB, reportA)).toBeGreaterThan(0);
    });

    test('should handle null values gracefully', () => {
        const reportA = createHealthReport({ status: 'healthy', latency: null, block: null, blocksaway: null, message: null });
        const reportB = createHealthReport({ status: 'healthy', latency: 10, block: 5, blocksaway: 10, message: "Hello" });
        expect(CompareHealthReportByStatusLatency(reportB, reportA)).toBeGreaterThan(0);
        expect(CompareHealthReportByStatusLatency(reportA, reportB)).toBeLessThan(0);
    });

    test('should throw an error for invalid status values', () => {
        const invalidStatusReport = createHealthReport({ status: 'superhealthy', latency: null, block: null, blocksaway: null, message: null });
        const validReport = createHealthReport({ status: 'healthy', latency: null, block: null, blocksaway: null, message: null });
        expect(() => CompareHealthReportByStatusLatency(invalidStatusReport, validReport)).toThrow();
        expect(() => CompareHealthReportByStatusLatency(validReport, invalidStatusReport)).toThrow();
    });
});

describe('RoundDateToNearest15Minutes', () => {
    // Test case 1: Time is already at a quarter-hour mark
    it('returns the same time if already at a quarter-hour mark', () => {
        const dates = [
            new Date(2024, 0, 1, 10, 0),
            new Date(2024, 0, 1, 10, 15),
            new Date(2024, 0, 1, 10, 30),
            new Date(2024, 0, 1, 10, 45),
        ];

        dates.forEach(date => {
            const roundedDate = RoundDateToNearest15Minutes(date);
            expect(roundedDate).toEqual(date);
        });
    });

    // Test case 2: Time is just after a quarter-hour mark
    it('rounds down to the nearest quarter-hour when minutes are just after', () => {
        const date = new Date(2024, 0, 1, 10, 16); // Just after 10:15
        const expected = new Date(2024, 0, 1, 10, 15);

        const roundedDate = RoundDateToNearest15Minutes(date);
        expect(roundedDate).toEqual(expected);
    });

    // Test case 3: Time is just before a quarter-hour mark
    it('rounds down to the nearest quarter-hour when minutes are just before the next', () => {
        const date = new Date(2024, 0, 1, 10, 29); // Just before 10:30
        const expected = new Date(2024, 0, 1, 10, 15);

        const roundedDate = RoundDateToNearest15Minutes(date);
        expect(roundedDate).toEqual(expected);
    });

    // Test case 4: Additional tests for rounding down at various minutes
    it('correctly rounds down at various minutes', () => {
        const tests = [
            { input: new Date(2024, 0, 1, 10, 1), expected: new Date(2024, 0, 1, 10, 0) },
            { input: new Date(2024, 0, 1, 10, 14), expected: new Date(2024, 0, 1, 10, 0) },
            { input: new Date(2024, 0, 1, 10, 31), expected: new Date(2024, 0, 1, 10, 30) },
            { input: new Date(2024, 0, 1, 10, 44), expected: new Date(2024, 0, 1, 10, 30) },
            { input: new Date(2024, 0, 1, 10, 46), expected: new Date(2024, 0, 1, 10, 45) },
            { input: new Date(2024, 0, 1, 10, 59), expected: new Date(2024, 0, 1, 10, 45) },
        ];

        tests.forEach(({ input, expected }) => {
            const roundedDate = RoundDateToNearest15Minutes(input);
            expect(roundedDate).toEqual(expected);
        });
    });
});

describe('applyHealthResponseGroupingAndTextFormatting', () => {
    it('correctly groups, sorts, and formats health reports', () => {
        // Mock health reports with different timestamps, statuses, latencies, etc.
        const healthReports = [
            // Two reports in the same 15-minute interval but different statuses and latencies
            { timestamp: new Date('2024-01-01T10:10:00Z'), status: 'healthy', latency: 200, block: 100, blocksaway: 5, message: null, id: 1, provider: 'provider1', spec: 'specA', interface: 'interfaceA' },
            { timestamp: new Date('2024-01-01T10:12:00Z'), status: 'unhealthy', latency: 100, block: 105, blocksaway: 2, message: null, id: 2, provider: 'provider2', spec: 'specB', interface: 'interfaceB' },
            // A report in a different 15-minute interval
            { timestamp: new Date('2024-01-01T10:25:00Z'), status: 'frozen', latency: 300, block: 110, blocksaway: 1, message: null, id: 3, provider: 'provider3', spec: 'specC', interface: 'interfaceC' }
        ];

        // Expected result after grouping, sorting, and formatting
        const expected = [
            // Expected formatting for the 'message' field and sorted order should be checked
            // Note: This is a simplified representation; you'll need to adjust according to your formatting logic
            { ...healthReports[1], message: 'Block: 0x69 / Others: 0x6b, latency: 0 ms' },
            { ...healthReports[2], message: 'Block: 0x6e / Others: 0x6f, latency: 0 ms' }
        ];

        // Mock the dependent functions if necessary (e.g., roundDateToNearest15Minutes, CompareHealthReportByStatusLatency)

        const result = ApplyHealthResponseGroupingAndTextFormatting(healthReports);

        // Verify the grouping, sorting, and message formatting
        expect(result).toEqual(expected);
    });

});


describe('GroupHealthReportBy15MinutesWithSort', () => {
    it('groups reports by 15-minute intervals and sorts them within groups', () => {
        const reports = [
            { id: 1, timestamp: new Date('2024-01-01T10:14:59Z'), status: 'healthy', latency: 200, block: 100, blocksaway: 1, message: 'Report 1', provider: 'providerA', spec: 'specA', interface: 'interfaceA' },
            { id: 2, timestamp: new Date('2024-01-01T10:15:01Z'), status: 'unhealthy', latency: 100, block: 100, blocksaway: 2, message: 'Report 2', provider: 'providerB', spec: 'specB', interface: 'interfaceB' },
            { id: 3, timestamp: new Date('2024-01-01T10:00:00Z'), status: 'frozen', latency: 300, block: 100, blocksaway: 3, message: 'Report 3', provider: 'providerC', spec: 'specC', interface: 'interfaceC' },
        ];

        const expectedGroupKeys = [
            '2024-01-01T10:00:00.000Z',
            '2024-01-01T10:15:01.000Z',
        ];

        const sortedAndGrouped = GroupHealthReportBy15MinutesWithSort(reports);

        // Verify the number of groups matches expectation
        expect(sortedAndGrouped.length).toBe(expectedGroupKeys.length);

        sortedAndGrouped.forEach((report, index) => {
            const groupTimestamp = new Date(report.timestamp).toISOString();
            expect(groupTimestamp).toBe(expectedGroupKeys[index]);
        });
    });

    it('handles empty input', () => {
        const reports = [];
        const result = GroupHealthReportBy15MinutesWithSort(reports);
        expect(result).toEqual([]);
    });

});
