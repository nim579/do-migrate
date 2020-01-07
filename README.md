# Do Migrate!

PostgreSQL migration tool on Node.js.

## Overview

Table schema:
* name
* do_sql — executed migration
* undo_sql — undo migration SQL commands
* do_hash — executed migration hash (SHA-256)
* undo_hash — undo migration hash (SHA-256)
* exec_date — executed date

Files:
* `{name}.do.sql` — migration file
* `{name}.undo.sql` — undo migration file
* `order` — file with ordered migrations names.

Inspect data exapmle:
``` js
{
    "table": {
        "initial": {
            "name": "initial",
            "do_hash": "870f2713310e990bd8ed4951fb9560fb8591def24a324abea0d8fd010940752a",
            "do_sql": "CREATE TABLE test (\n    key varchar(255) UNIQUE,\n    value text\n);\n",
            "undo_hash": "5111d07169d0ba3c9f4c861fa6076c786f86469e298450c641c3e70ea21df8f6",
            "undo_sql": "DROP TABLE test;\n",
            "exec_date": "2017-05-10T15:33:40.485Z"
        },
        "test_name": {
            "name": "test_name",
            "do_hash": "bb8d5549c23390eeef2293dc3366e6e97f33102d9326e42af8ee80ec1afba988",
            "do_sql": "ALTER TABLE test ADD COLUMN is_json boolean NOT NULL DEFAULT false;\n\nCREATE TABLE test2 (\n    key varchar(255)  UNIQUE,\n    value text\n);\n",
            "undo_hash": "0fcb0be684de7480b38486d654c8e89a4a23233dafe6a9bae20ce860c1d78fac",
            "undo_sql": "ALTER TABLE test DROP COLUMN IF EXISTS is_json;\n\nDROP TABLE test2;\nDROP TABLE _test2;\n",
            "exec_date": "2017-05-10T15:34:17.961Z"
        }
    },
    "files": {
        "initial": {
            "do_sql": "CREATE TABLE test (\n    key varchar(255) UNIQUE,\n    value text\n);\n",
            "undo_sql": "DROP TABLE test;\n",
            "do_hash": "870f2713310e990bd8ed4951fb9560fb8591def24a324abea0d8fd010940752a",
            "undo_hash": "5111d07169d0ba3c9f4c861fa6076c786f86469e298450c641c3e70ea21df8f6"
        },
        "test_name": {
            "do_sql": "ALTER TABLE test ADD COLUMN is_json boolean NOT NULL DEFAULT false;\n\nCREATE TABLE test2 (\n    key varchar(255) UNIQUE,\n    value text\n);\n",
            "undo_sql": "ALTER TABLE test DROP COLUMN IF EXISTS is_json;\n\nDROP TABLE test2;\nDROP TABLE _test2;\n",
            "do_hash": "bb8d5549c23390eeef2293dc3366e6e97f33102d9326e42af8ee80ec1afba988",
            "undo_hash": "0fcb0be684de7480b38486d654c8e89a4a23233dafe6a9bae20ce860c1d78fac"
        }
    },
    "map": [
        {
            "name": "initial",
            "state": "executed"
        }, {
            "name": "test_name",
            "state": "executed"
        }
    ]
}
```

### Statuses
* executed — Already executed migration
* removed — Migration removed (executed "undo migration")
* changed — Migration changed (executed "undo migration" and "do migration")
* added — Migration added (executed "do migration")
* inited — special status on initial migrations
* shrink — special status for shrink migrations

### Order file

Migrations order list by names.
Example:
```
name1
name2
name3
```

**Initiated cursor:**
```
~inited~
```

Use it if you integrating migrator in an existing project. Migrations before this cursor will not be executed if that not in table schema and just added to it. Can be placed on any line.


**Shrinking cursor:**
```
~shrink~~
```

Use it if you want to remove very old migrations files from your project. Migrations before this cursor will be ignored and you can remove migrations files and names in order list. Can be placed on any line.

## Install

Clone repo and run `npm install` or use Docker.


## CLI usage

Globaly:
``` bash
$ do-migrate <args> [command] [params]
```

Localy:
``` bash
$ $(npm bin)/do-migrate -- <args> [command] [params]
```

Commands:
* **run** — Run all migrations if needed, without asking
* **interactive** — Run migrations in interactive mode
* **inspect** — List all migrations with states
* **remove** *<migration>* — Remove migration

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


## Program usage

``` coffee
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


## Docker usage

### Build base image

Dockerfile:
``` docker
FROM nim579/do-migrate

ADD ./migrations /migrator/migrations
ADD ./env.json /migrator/env.json # Optional env variables map file

CMD [ "interactive" ] # Optional command and args for CLI
```

Command:
``` bash
$ docker run --name migrator -d -e ... nim579/do-migrate
```

Command:
```
$ docker run --name migrator -it -e ... nim579/do-migrate interactive
```

Compose:
``` yaml
version: "2"
services:
  migrator:
    image: app-migrator
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      MIGRATOR_DB_HOST=localhost
      MIGRATOR_DB_PORT=5432
      MIGRATOR_DB_USER=postgres
      MIGRATOR_DB_PASSWORD=admin
      MIGRATOR_DB_DATABASE=test
```

### From original image

Command:
``` bash
$ docker run --name migrator -d -e ... --volume ./migrations:/migrator/migrations nim579/do-migrate
```

Command for interactive:
```
$ docker run --name migrator -it -e ... --volume ./migrations:/migrator/migrations nim579/do-migrate interactive
```

Compose:
``` yaml
version: "2"
services:
  migrator:
    image: nim579/do-migrate
    environment:
      MIGRATOR_DB_HOST=localhost
      MIGRATOR_DB_PORT=5432
      MIGRATOR_DB_USER=postgres
      MIGRATOR_DB_PASSWORD=admin
      MIGRATOR_DB_DATABASE=test
    volume:
      - ./migrations:/migrator/migrations:ro
```
