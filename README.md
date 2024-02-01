# Do Migrate

PostgreSQL migration tool on Node.js.

## Overview

This SQL migration tool is designed to facilitate seamless database schema evolution. It operates based on a directory containing migration scripts and a defined order of execution. Here’s an overview of its core principles:

## Migration Directory Structure

1. *Migration Files*: The tool relies on a structured folder containing SQL migration files. Each migration consists of two files: `{name}.do.sql` for applying the migration and `{name}.undo.sql` for reverting it.
2. *Order File*: Within the migration folder, an `order` file explicitly lists the names of the migrations in the sequence they should be applied. This ensures controlled and predictable migration execution.

## Migration Execution Logic

1. *Applying New Migrations*: When a new migration is added to the directory and listed in the `order` file, the tool automatically executes the corresponding `.do.sql` file to apply the migration.
2. *Reverting Migrations*: If a migration is removed from the order file, the tool finds the associated .undo.sql file and executes it to revert the migration.
3. *Modifying Migrations*: Should a migration be altered, the tool first reverts the previous version of the migration using the .undo.sql file and then applies the new version with the `.do.sql` file.
4. *Handling Mid-List Changes*: Any changes (addition, deletion, modification) not at the end of the order list trigger the tool to revert migrations in reverse order up to the point of the earliest change. Subsequently, it applies all new or modified migrations in the correct sequence.

### SQL Migration History Table

Crucially, the tool maintains a table within the database that records the history of applied migrations along with their corresponding undo scripts. This facilitates efficient tracking of changes and enables precise rollback capabilities, ensuring the database schema can be accurately reverted to any previous state as defined by the migration history.

Columns:

* name
* do_sql — executed migration
* undo_sql — undo migration SQL commands
* do_hash — executed migration hash (SHA-256)
* undo_hash — undo migration hash (SHA-256)
* exec_date — executed date

### Possible actions

* executed — Already executed migration
* removed — Migration removed (executed "undo migration")
* changed — Migration changed (executed "undo migration" and "do migration")
* added — Migration added (executed "do migration")
* inited — special status on initial migrations
* shrink — special status for shrink migrations

### Ordering and file structure

Example `order` file:

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

## Docker

Inspect:

``` sh
docker run --name migrator -e MIGRATOR_DB_HOST=localhost -e ... --volume ./migrations:/migrator/migrations nim579/do-migrate
```

Execute:

``` sh
docker run --name migrator -e MIGRATOR_DB_HOST=localhost -e ... --volume ./migrations:/migrator/migrations nim579/do-migrate --exec
```

Docker Compose:

``` yaml
version: "2"
services:
  migrator:
    image: nim579/do-migrate:2
    command:
       - "--exec"
    environment:
      - MIGRATOR_DB_HOST
      - MIGRATOR_DB_PORT
      - MIGRATOR_DB_USER
      - MIGRATOR_DB_PASSWORD
      - MIGRATOR_DB_DATABASE
    volume:
      - ./migrations:/migrator/migrations
```
