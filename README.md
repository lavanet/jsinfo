## Js info

### Generate migrations
If you make changes to the schema, make migrations:
```bash
npm run generate
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
```

### Run
``` bash
bunx ts-node src/indexer.ts
bunx ts-node src/query.ts 
```
