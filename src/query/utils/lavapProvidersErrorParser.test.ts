// jsinfo/src/query/utils/lavapProvidersErrorParser.test.ts

// psql -h localhost -p 5434 -U postgres -d relays
// \copy (SELECT DISTINCT errors FROM lava_report_error) TO '/tmp/errors.csv' WITH CSV HEADER;

const { readFileSync } = require('fs');
const { ParseLavapProviderError } = require('./lavapProvidersErrorParser');

if (require.main === module) {
    const data = readFileSync('/tmp/errors.csv', 'utf-8');
    const lines = data.split('\n').slice(1); // split by newline and skip the header line

    let uniqueOutputs = new Set<string>();

    for (let line of lines) {
        // remove first and last quotes if they are there
        if (line.startsWith('"')) {
            line = line.slice(1);
        }
        if (line.endsWith('"')) {
            line = line.slice(0, -1);
        }

        let parsedError = ParseLavapProviderError(line);
        if (!uniqueOutputs.has(parsedError)) {
            uniqueOutputs.add(parsedError);
            console.log(parsedError); // print immediately
        }
    }
}