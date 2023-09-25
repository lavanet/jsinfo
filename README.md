## Js info

### Create db
```bash
sudo -u postgres dropdb jsinfo
sudo -u postgres createdb jsinfo
npm run generate

sudo -u jsinfo psql
```

### Run
``` bash
bunx ts-node src/indexer.ts
bunx ts-node src/query.ts 
```