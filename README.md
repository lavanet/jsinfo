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
