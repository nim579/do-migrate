pkg     = require '../package.json'
_       = require 'lodash'
rl      = require 'readline'
program = require 'commander'

mapEnv = require '../env.json'
Migrator = require './migrator'


class MigratorCLI
    mapParams:
        'host': 'host'
        'port': 'port'
        'user': 'user'
        'password': 'password'
        'database': 'database'
        'schemaTable': 'schema_table'
        'schemaName': 'schema_name'
        'migrations': 'migrations'
        'listName': 'migrations_list'

    actions:
        added:
            txt: 'Add'
            command: 'add'

        changed:
            txt: 'Change'
            command: 'change'

        removed:
            txt: 'Remove'
            command: 'remove'

        executed:
            txt: "Skip"

    constructor: (args, env)->
        @actionFound = false
        @mapEnv = _.clone mapEnv
        @env = env

        @_initProgram args

        @migrate() unless @actionFound

    _initProgram: (args)->
        @program = program

        program
        .option '--host <host>', 'Database host (env: MIGRATOR_DB_HOST)'
        .option '--port <number>', 'Database port', Number
        .option '--user <username>', 'Database user'
        .option '--password <password>', 'Database password'
        .option '--database <base_name>', 'Database schema name'
        .option '--schema-table <name>', 'Migrator table name'
        .option '--schema-name <name>', 'Database schema name'
        .option '-M, --migrations <path>', 'Path to migrations files'
        .option '-L, --list-name <name>', 'Migrations order list file name'

        program
        .command 'run'
        .description 'Run all migrations if needed, without asking'
        .action ({parent})=>
            @actionFound = true
            @migrate parent

        program
        .command 'interactive'
        .description 'Run migrations in interactive mode'
        .action ({parent})=>
            @actionFound = true
            @interactive parent

        program
        .command 'inspect'
        .description 'List all migrations with states'
        .action ({parent})=>
            @actionFound = true
            @inspect parent

        program
        .command 'remove <migration>'
        .description 'Remove migration'
        .action (name, {parent})=>
            @actionFound = true
            @remove parent, name

        program
        .version pkg.version
        .parse args

    getOptions: (program = @program, env = @env)->
        params = {}

        _.forEach @mapEnv, (param, key)->
            value = _.get env, key
            _.set params, param, value if value

        _.forEach @mapParams, (param, key)->
            value = _.get program, key
            _.set params, param, value if value

        return params

    migrate: (program = @program)->
        options = @getOptions()
        console.log "Migrator started..."

        try
            migrator = new Migrator options

        catch e
            return @_error e

        progress = (action, name)=>
            ops = @actions[action]

            if ops
                console.log "#{ops.txt} migration \"#{name}\":\tdone"

            else
                console.log "Migration \"#{name}\":\t#{action}"

        migrator.migrate progress
        .then (migrations)->
            if not migrations.map or not migrations.map.length > 0
                console.log 'No migrations found'

            console.log "\nMigrator ended successful"

            migrator.destroy()
            process.exit 0

        .catch (e)=>
            @_error e

            migrator.destroy()
            process.exit 1

    interactive: (program = @program)->
        options = @getOptions()
        console.log "Interactive migrator started..."

        try
            migrator = new Migrator options

        catch e
            return @_error e

        asker = _.bind @_ask, @

        migrator.inspect()
        .then (migrations)->
            if migrations.map and migrations.map.length > 0
                ask = rl.createInterface
                    input:  process.stdin
                    output: process.stdout

                loader = Promise.resolve()

                _.forEach migrations.map, (migration)->
                    loader = loader.then -> asker migrator, ask, migration

                loader = loader.then -> ask.close()
                return loader

            else
                console.log 'No migrations found'

        .then ->
            console.log "\nMigrator ended successful"

            migrator.destroy()
            process.exit 0

        .catch (e)=>
            @_error e

            migrator.destroy()
            process.exit 1

    inspect: (program = @program)->
        options = @getOptions()
        console.log "Inspection started..."

        try
            migrator = new Migrator options

        catch e
            return @_error e

        migrator.inspect()
        .then (migrations)->
            if migrations.map and migrations.map.length > 0
                console.log "\nMigrations list:"

                for migration in migrations.map
                    console.log "Migration \"#{migration.name}\":\t#{migration.state}"

            else
                console.log 'No migrations found'

            console.log "\nMigrator ended successful"

            migrator.destroy()
            process.exit 0

        .catch (e)=>
            @_error e

            migrator.destroy()
            process.exit 1

    remove: (program = @program, name)->
        options = @getOptions()
        console.log "Remove migration started for \"#{name}\"..."

        try
            migrator = new Migrator options

        catch e
            return @_error e

        migrator.inspect()
        .then (migrations)->
            migration = _.find migrations.table, {name}

            if migration
                migrator.remove name, true
                .then ->
                    console.log "\nMigration \"#{name}\" removed"

            else
                console.log "\nMigration \"#{name}\" not found"

        .then ->
            console.log "\nMigrator ended successful"

            migrator.destroy()
            process.exit 0

        .catch (e)=>
            @_error e

            migrator.destroy()
            process.exit 1

    _ask: (migrator, ask, migration)->
        ops = @actions[migration.state]

        return console.log "Skip migration \"#{migration.name}\"" unless ops and ops.command

        new Promise (resolve, reject)->
            ask.question "#{ops.txt} migration \"#{migration.name}\" [yes/no] (no): ", (accept)->
                unless accept is 'yes'
                    console.log "Skip migration \"#{migration.name}\""
                    return resolve()

                migrator[ops.command] migration.name, true
                .then ->
                    console.log "#{ops.txt} migration \"#{migration.name}\":\tdone"
                    resolve()

                .catch (e)->
                    console.error "#{ops.txt} migration \"#{migration.name}\":\tfailed"
                    reject e

    _error: (e)->
        console.error '\n\n'
        if e.code
            console.error "Error: #{e.code}"
            console.error "Migration: #{e.name}" if e.name
            console.error e.err if e.err

        else
            console.error e


new MigratorCLI process.argv, process.env
