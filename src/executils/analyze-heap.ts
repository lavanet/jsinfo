// analyze-heap.ts

import { readFileSync } from 'fs';

const snapshotFile = 'heap-snapshot-2024-11-06T22-08-45-401Z.json';
console.log('Loading snapshot...');
const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf-8'));

// Create a map of node indices to their edges
const nodeToEdges = new Map();
for (let i = 0; i < snapshot.edges.length; i += 3) {
    const fromNode = Math.floor(i / 3);
    const toNode = snapshot.edges[i + 1];
    if (!nodeToEdges.has(toNode)) {
        nodeToEdges.set(toNode, []);
    }
    nodeToEdges.get(toNode).push(fromNode);
}

console.log('\nAnalyzing nodes...');

// Track allocations with retainers and more details
const typeStats = new Map();

// Add more detailed edge type mapping
const edgeTypeNames = {
    context: 'Context Variable',
    element: 'Array Element',
    property: 'Object Property',
    internal: 'Internal Field',
    hidden: 'Hidden Property',
    shortcut: 'Weak Reference',
    weak: 'Weak Reference'
};

// Process nodes
for (let i = 0; i < snapshot.nodes.length; i += 6) {
    const nodeType = snapshot.nodeClassNames[snapshot.nodes[i + 0]];
    const name = snapshot.nodes[i + 1];
    const size = snapshot.nodes[i + 2];
    const edgeCount = snapshot.nodes[i + 3];
    const edgeIndex = snapshot.nodes[i + 4];

    if (!typeStats.has(nodeType)) {
        typeStats.set(nodeType, {
            count: 0,
            size: 0,
            retainers: new Map(),
            edgeTypes: new Map(),  // Track edge type distribution
            childTypes: new Map(), // Track types of children
            avgSize: 0,           // Track average size
            maxSize: 0,           // Track largest instance
            maxEdges: 0           // Track most connected instance
        });
    }

    const stats = typeStats.get(nodeType);
    stats.count++;
    stats.size += size;
    stats.avgSize = stats.size / stats.count;
    stats.maxSize = Math.max(stats.maxSize, size);
    stats.maxEdges = Math.max(stats.maxEdges, edgeCount);

    // Find retaining nodes and analyze edges
    const retainers = nodeToEdges.get(i / 6) || [];
    for (const retainer of retainers) {
        const retainerType = snapshot.nodeClassNames[snapshot.nodes[retainer * 6]];
        const retainerName = snapshot.nodes[retainer * 6 + 1];
        const edgeIndex = snapshot.nodes[retainer * 6 + 4];
        const edgeCount = snapshot.nodes[retainer * 6 + 3];

        // Get edge information
        for (let e = 0; e < edgeCount; e++) {
            const edgeType = snapshot.edgeTypes[snapshot.edges[edgeIndex + e * 3]];
            const edgeName = snapshot.edgeNames[snapshot.edges[edgeIndex + e * 3 + 2]];

            // Track edge type distribution
            if (!stats.edgeTypes.has(edgeType)) {
                stats.edgeTypes.set(edgeType, 0);
            }
            stats.edgeTypes.set(edgeType, stats.edgeTypes.get(edgeType)! + 1);

            const key = `${retainerType}:${edgeTypeNames[edgeType] || edgeType}:${edgeName || 'anonymous'}`;

            if (!stats.retainers.has(key)) {
                stats.retainers.set(key, {
                    count: 0,
                    size: 0,
                    edgeType,
                    retainerType
                });
            }
            const retainerStats = stats.retainers.get(key);
            retainerStats.count++;
            retainerStats.size += size;
        }
    }
}

// Print enhanced results
console.log('\nDetailed Memory Analysis:');
Array.from(typeStats.entries())
    .sort(([, a], [, b]) => b.size - a.size)
    .slice(0, 5)
    .forEach(([type, stats]) => {
        console.log(`\n${type}:`);
        console.log(`  Total Count: ${stats.count.toLocaleString()}`);
        console.log(`  Total Size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Average Size: ${(stats.avgSize / 1024).toFixed(2)}KB`);
        console.log(`  Largest Instance: ${(stats.maxSize / 1024).toFixed(2)}KB`);
        console.log(`  Max Edge Count: ${stats.maxEdges}`);

        console.log('\n  Edge Type Distribution:');
        Array.from(stats.edgeTypes.entries())
            .sort(([, a], [, b]) => b - a)
            .forEach(([edgeType, count]) => {
                console.log(`    ${edgeType}: ${count}`);
            });

        console.log('  Top Retainers:');
        Array.from(stats.retainers.entries())
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 5)
            .forEach(([retainer, retainerStats]) => {
                const sizeInMB = (retainerStats.size / 1024 / 1024).toFixed(2);
                console.log(`    ${retainer}`);
                console.log(`      Count: ${retainerStats.count.toLocaleString()}`);
                console.log(`      Size: ${sizeInMB}MB`);
                console.log(`      Edge Type: ${retainerStats.edgeType}`);
                console.log(`      Retainer Type: ${retainerStats.retainerType}`);
            });
    });

// Print memory usage
const memUsage = process.memoryUsage();
console.log('\nProcess Memory Usage:');
Object.entries(memUsage).forEach(([key, value]) => {
    console.log(`${key}: ${(value / 1024 / 1024).toFixed(2)}MB`);
});