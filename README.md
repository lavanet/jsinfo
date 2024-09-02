## JsInfo

### Generate migrations

If you make changes to the schema, make migrations:

```bash
make create_migrations
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
pg_restore -d postgres://localhost:5432/jsinfo jsinfo_db.dump

# Dump for GCP import
sudo -u jsinfo pg_dump --format=p --no-owner --no-acl jsinfo > dump.sql
```

### Run

```bash
make run_indexer
make run_query
```

### Docker

```bash
make docker_build
make docker_compose
```

baseLatencyProbe: 150*ms
To get the benchmark latency:
150+50*10 = 650
```
