# Do Migrate

PostgreSQL migration tool on Node.js.

## Overview

### SQL table for sync:

* name
* do_sql — executed migration
* undo_sql — undo migration SQL commands
* do_hash — executed migration hash (SHA-256)
* undo_hash — undo migration hash (SHA-256)
* exec_date — executed date

### Action plan

* executed — Already executed migration
* removed — Migration removed (executed "undo migration")
* changed — Migration changed (executed "undo migration" and "do migration")
* added — Migration added (executed "do migration")
* inited — special status on initial migrations
* shrink — special status for shrink migrations

### Ordering and file structure

Migrations order list by names.

Example order file:

```txt
migration1
migration2
migration3
```

Example migrations dir list:

```txt
migration1.do.sql
migration1.undo.sql
migration2.do.sql
migration2.undo.sql
migration3.do.sql
migration3.undo.sql
order
```

## Install

Clone repo and run `npm install do-migrate` or use Docker.

## CLI usage

View action plan:

``` bash
npx do-migrate [options]
```

Execute:

``` bash
npx do-migrate --exec [options]
```

Options:

* **-h**, **--help** — output usage information
* **--host** *<host>* — Database host
* **--port** *<number>* — Database port
* **--user** *<username>* — Database user
* **--password** *<password>* — Database password
* **--database** *<base_name>* — Database schema name
* **--schema-table** *<name>* — Migrator table name
* **-M**, **--migrations** *<path>* — Path to migrations files
* **-L**, **--list-name** *<name>* — Migrations order list file name
* **-V**, **--version** — output the version number

Env variables:

* `MIGRATOR_DB_HOST` — Database host (default: localhost)
* `MIGRATOR_DB_PORT` — Database port (default: 5432)
* `MIGRATOR_DB_USER` — Database user (default: postgres)
* `MIGRATOR_DB_PASSWORD` Database password (default empty)
* `MIGRATOR_DB_DATABASE` — Database name (default: postgres)
* `MIGRATOR_DB_SCHEMA_NAME` — Database schema name (default: public)
* `MIGRATOR_DB_SSL_REQUIRED` — SSL required flag (user true/false, default: false)
* `MIGRATOR_DB_SSL_CA` — SSL CA (pem string)
* `MITRATOR_FILES_PATH` — Path to migration dir (default: ./migrations)
* `MITRATOR_ORDER_FILE` — Order file name (default: order)
* `MIGRATOR_TABLE_NAME` — Sync table name (default: schema_versions)

## API usage

``` ts
Migrator = require('do-migrate')

migrator = new Migrator options
migrator.migrate()
```

Options:

* *host* — Database host
* *port* — Database port
* *user* — Database user
* *password* — Database password
* *database* — Database schema name
* *migrations* — Path to migrations files
* *migrations_list* — Migrations order list file name
* *schema_table* — Migrator table name

Methods:

* **inspect(callback)** — return promise with info about migrations.
* **migrate(progress)** — migrate all needed migrations. Return promise with info about migrations. In *progress* return migration status (action and migration name).
* **remove(name, transaction=true)** – force remove migration by name (*transaction* is flag if is single transaction). Return promise,
* **change(name, transaction=true)** — force change migration by name (*transaction* is flag if is single transaction). Return promise,
* **add(name, transaction=true)** — force add migration by name (*transaction* is flag if is single transaction). Return promise,
* **destroy()** — close DB connection and destroy migrator

Inspect data structure:

* table — migrations executed and saved in DB table (name, do_sql, undo_sql, do_hash `sha256`, undo_hash `sha256`, exec_date)
* files — migrations in files (name, do_sql, undo_sql, do_hash `sha256`, undo_hash `sha256`, exec_date)
* map — all migrations (name, state)

States:

* executed — already executed
* added — new migration
* changed — changed migration
* removed – removed migration
* inited — initial migration
* shrink — shrink migration

## Docker

Command:

``` sh
docker run --name migrator -e MIGRATOR_DB_HOST=localhost -e ... --volume ./migrations:/migrator/migrations nim579/do-migrate
```

Docker Compose:

``` yaml
version: "2"
services:
  migrator:
    image: nim579/do-migrate:2
    environment:
      - MIGRATOR_DB_HOST
      - MIGRATOR_DB_PORT
      - MIGRATOR_DB_USER
      - MIGRATOR_DB_PASSWORD
      - MIGRATOR_DB_DATABASE
    volume:
      - ./migrations:/migrator/migrations
```
