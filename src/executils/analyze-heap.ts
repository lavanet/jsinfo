// analyze-heap.ts

import { readFileSync } from 'fs';

const snapshotFile = 'heap-snapshot-2024-11-07T07-43-26-491Z.json';
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
    .slice(0, 20)  // Top 20 types by size
    .forEach(([type, stats]) => {
        printObjectAnalysis(type, stats);
    });

// Print memory usage
const memUsage = process.memoryUsage();
console.log('\nProcess Memory Usage:');
Object.entries(memUsage).forEach(([key, value]) => {
    console.log(`${key}: ${(value / 1024 / 1024).toFixed(2)}MB`);
});

// Add these new analysis functions
function analyzeStructures(snapshot) {
    const structureStats = new Map();

    for (let i = 0; i < snapshot.nodes.length; i += 6) {
        const nodeType = snapshot.nodeClassNames[snapshot.nodes[i + 0]];
        const structureId = snapshot.nodes[i + 1];  // Structure ID
        const size = snapshot.nodes[i + 2];

        const key = `${nodeType}@${structureId}`;
        if (!structureStats.has(key)) {
            structureStats.set(key, {
                count: 0,
                totalSize: 0,
                retainedSize: 0,
                examples: []
            });
        }

        const stats = structureStats.get(key);
        stats.count++;
        stats.totalSize += size;
        if (stats.examples.length < 3) {  // Keep a few examples
            stats.examples.push(i);
        }
    }

    // Print structure analysis
    console.log('\nUnique Object Structures:');
    Array.from(structureStats.entries())
        .sort(([, a], [, b]) => b.totalSize - a.totalSize)
        .slice(0, 20)  // Top 20 structures
        .forEach(([structure, stats]) => {
            console.log(`\n${structure}:`);
            console.log(`  Instances: ${stats.count}`);
            console.log(`  Total Size: ${(stats.totalSize / 1024).toFixed(2)}KB`);
            console.log(`  Average Size: ${(stats.totalSize / stats.count).toFixed(2)} bytes`);

            // Print example properties if available
            if (stats.examples.length > 0) {
                const nodeIndex = stats.examples[0];
                const edgeStart = snapshot.nodes[nodeIndex + 4];
                const edgeCount = snapshot.nodes[nodeIndex + 3];

                console.log('  Properties:');
                const uniqueProperties = new Set();
                for (let e = 0; e < edgeCount; e++) {
                    const edgeNameIndex = snapshot.edges[edgeStart + e * 3 + 2];
                    const edgeName = snapshot.edgeNames[edgeNameIndex];
                    if (edgeName) {
                        uniqueProperties.add(edgeName);
                    }
                }

                // Print unique properties
                uniqueProperties.forEach(prop => {
                    console.log(`    - ${prop}`);
                });
            }
        });
}

// Add this call after your existing analysis
analyzeStructures(snapshot);

function printObjectAnalysis(type: string, stats: any) {
    console.log(`\n=== ${type} Analysis ===`);

    // Basic Stats
    console.log('\nBasic Statistics:');
    console.log(`  Instance Count: ${stats.count.toLocaleString()}`);
    console.log(`  Total Memory: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Average Size: ${(stats.avgSize / 1024).toFixed(2)}KB`);
    console.log(`  Largest Instance: ${(stats.maxSize / 1024).toFixed(2)}KB`);
    console.log(`  Max Connections: ${stats.maxEdges}`);

    // Edge Types
    console.log('\nConnection Types:');
    (Array.from(stats.edgeTypes.entries()) as any)
        .sort(([, a], [, b]) => b - a as number)
        .forEach(([edgeType, count]) => {
            console.log(`  ${edgeType}: ${count.toLocaleString()}`);
        });

    // Retainers by Category
    console.log('\nTop Memory Holders:');
    const retainersByType = new Map();

    (Array.from(stats.retainers.entries()) as any)
        .sort(([, a], [, b]) => (b.size - a.size) as number)
        .slice(0, 10)
        .forEach(([key, info]) => {
            const [retainerType, edgeType, name] = key.split(':');
            const category = `${retainerType} via ${edgeType}`;

            if (!retainersByType.has(category)) {
                retainersByType.set(category, []);
            }

            retainersByType.get(category).push({
                name: name || 'anonymous',
                count: info.count,
                sizeMB: (info.size / 1024 / 1024).toFixed(2)
            });
        });

    retainersByType.forEach((items, category) => {
        console.log(`\n  ${category}:`);
        items.forEach(item => {
            console.log(`    ${item.name}`);
            console.log(`      Count: ${item.count.toLocaleString()}`);
            console.log(`      Size: ${item.sizeMB}MB`);
        });
    });
}