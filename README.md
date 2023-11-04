## Js info

### Generate migrations
If you make changes to the schema, make migrations:
```bash
bun run generate
```

### Create db
```bash
sudo -u postgres dropdb jsinfo
sudo -u postgres createdb jsinfo

sudo -u jsinfo psql
```

### Backup
```bash
# Dump
sudo -u jsinfo pg_dump -Fc > db.dump

# Recover
pg_restore -d postgres://addr:port/postgres db.dump

# Dump for GCP import
sudo -u jsinfo pg_dump --format=p --no-owner --no-acl jsinfo > dump.sql
```

### Run
``` bash
bunx ts-node src/indexer.ts
bunx ts-node src/query.ts 
```

### Docker
```bash
docker compose up -d
docker compose logs -f
```

### Todo
* QOS per chain per provider graph
* Pagination
* Screen provider CU by subscription address
* Move important events from generic events table to custom events table
* Add QoS Excellence
```
Latency base:
baseLatencyRelay := (150*ms) po.baseWorldLatency + (100*ms *CU / 2) common.BaseTimePerCU(cu)
baseLatencyProbe: 150*ms
To get the benchmark latency:
150+50*10 = 650
```
