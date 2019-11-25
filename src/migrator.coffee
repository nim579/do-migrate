_      = require 'lodash'
DB     = require './db'
Initer = require './initer'


class Migrator
    defaults: ->
        host: null
        port: null
        user: null
        password: null
        database: null
        migrations: './migrations'
        migrations_list: 'order'
        schema_table: 'schema_versions'
        schema_name: 'public'
        actions:
            do: 'do'
            undo: 'undo'

    constructor: (config)->
        @params = params = _.assign @defaults(), config

        unless @params.host and @params.port and @params.database and @params.migrations
            throw code: 'no_required_params', err: @params

        @db     = new DB     @params
        @initer = new Initer @params, @db

    destroy: ->
        @db.destroy()
        @data = null

    # Собирает карту изменений
    inspect: (callback)->
        migrator = @

        Promise.resolve()
        .then =>
            @initer.start()

        .then (data)->
            map = []

            inited = false
            shrink = false

            _.forEach data.order.reverse(), (name)->
                if not name or name[0] is '#'
                    return true

                if name is '~inited~'
                    inited = true
                    return true

                if name is '~shrink~'
                    shrink = true
                    return true

                state = 'executed'
                file  = data.files[name]
                table = data.table[name]

                if inited
                    state = 'inited'

                else if shrink
                    state = 'shrink'

                else unless table
                    state = 'added'

                else unless file
                    throw 'no_file'

                else if file.do_hash isnt table.do_hash
                    state = 'changed'

                map.unshift {name, state}

            _.forEach _.sortBy(data.table, 'exec_date'), (row)->
                unless _.includes data.order, row.name
                    map.unshift
                        name: row.name
                        state: 'removed'

            data.map = map
            migrator.data = data

            callback? null, data
            return data

        .catch (e)->
            callback? e

            if e.code
                throw e

            else
                throw code: 'inspect_error', err: e

    # Мигрирует все изменения
    migrate: (progress)->
        migrator = @

        Promise.resolve()
        .then =>
            @data or @inspect()

        .then (migrations)->
            init     = _.filter migrations.map, state: 'inited'
            remove   = _.filter migrations.map, state: 'removed'
            change   = _.filter migrations.map, state: 'changed'
            add      = _.filter migrations.map, state: 'added'
            shrink   = _.filter migrations.map, state: 'shrink'
            executed = _.filter migrations.map, state: 'executed'

            runner = (loader, action, result, name)->
                return loader
                .then ->
                    if migrator[action]
                        return migrator[action] name, false

                    else
                        return true

                .then ->
                    progress? result, name

                .catch (err)->
                    progress? 'fail', name
                    throw err

            loader = Promise.resolve()
            .then ->
                migrator.db.q "BEGIN"

            _.forEach init, ({name})->
                loader = runner loader, 'init', 'inited', name

            _.forEach shrink, ({name})->
                loader = runner loader, 'shrink', 'shrink', name

            _.forEach executed, ({name})->
                loader = runner loader, 'execute', 'executed', name

            _.forEach remove, ({name})->
                loader = runner loader, 'remove', 'removed', name

            _.forEach change, ({name})->
                loader = runner loader, 'change', 'changed', name

            _.forEach add, ({name})->
                loader = runner loader, 'add', 'added', name

            loader = loader
            .then ->
                migrator.db.q "COMMIT"

            .catch (err)->
                migrator.db.q "ROLLBACK"
                throw err

            return loader

        .then ->
            return migrator.data

    init: (name)->
        {schema_name, schema_table} = @params

        Promise.resolve()
        .then =>
            @data or @inspect()

        .then =>
            file = @data.files[name]

            if file
                return file

            else
                throw 'not_found'

        .then (file)=>
            @db.q """
                INSERT INTO #{schema_name}.#{schema_table} (name, do_hash, do_sql, undo_hash, undo_sql)
                VALUES ($1, $2, $3, $4, $5)
            """, [name, file.do_hash, file.do_sql, file.undo_hash, file.undo_sql]

        .then ->
            return true

        .catch (e)->
            throw code: 'migration_init', name: name, err: e

    remove: (name, transaction = true)->
        {schema_name, schema_table} = @params

        Promise.resolve()
        .then =>
            @data or @inspect()

        .then =>
            table = @data.table[name]

            if table
                return table

            else
                throw 'not_found'

        .then (data)=>
            if transaction
                @db.q "BEGIN"
                .then -> data

            else return data

        .then (table)=>
            if table.undo_sql
                @db.q table.undo_sql

            else return true

        .then =>
            @db.q "DELETE FROM #{schema_name}.#{schema_table} WHERE name = $1", [name]

        .then =>
            if transaction
                @db.q "COMMIT"

            else return true

        .catch (e)=>
            if transaction
                return @db.q "ROLLBACK"

            throw code: 'migration_remove', name: name, err: e

    change: (name, transaction = true)->
        {schema_name, schema_table} = @params

        Promise.resolve()
        .then =>
            @data or @inspect()

        .then =>
            table = @data.table[name]
            file  = @data.files[name]

            if table and file
                return {table, file}

            else
                throw 'not_found'

        .then (data)=>
            if transaction
                @db.q "BEGIN"
                .then -> data

            else return data

        .then ({table, file})=>
            if table.undo_sql
                @db.q table.undo_sql
                .then -> return file

            else return file

        .then (file)=>
            if file.do_sql
                @db.q file.do_sql
                .then -> return file

            else return file

        .then (file)=>
            @db.q """
                UPDATE #{schema_name}.#{schema_table}
                SET
                  do_hash = $2,
                  do_sql  = $3,
                  undo_hash = $4,
                  undo_sql  = $5,
                  exec_date = $6
                WHERE name = $1
            """, [name, file.do_hash, file.do_sql, file.undo_hash, file.undo_sql, new Date()]

        .then =>
            if transaction
                @db.q "COMMIT"

            else return true

        .catch (e)=>
            if transaction
                return @db.q "ROLLBACK"

            throw code: 'migration_change', name: name, err: e

    add: (name, transaction = true)->
        {schema_name, schema_table} = @params

        Promise.resolve()
        .then =>
            @data or @inspect()

        .then =>
            file = @data.files[name]

            if file
                return file

            else
                throw 'not_found'

        .then (data)=>
            if transaction
                @db.q "BEGIN"
                .then -> data

            else return data

        .then (file)=>
            if file.do_sql
                @db.q file.do_sql
                .then -> return file

            else return file

        .then (file)=>
            @db.q """
                INSERT INTO #{schema_name}.#{schema_table} (name, do_hash, do_sql, undo_hash, undo_sql)
                VALUES ($1, $2, $3, $4, $5)
            """, [name, file.do_hash, file.do_sql, file.undo_hash, file.undo_sql]

        .then =>
            if transaction
                @db.q "COMMIT"

            else return true

        .catch (e)=>
            if transaction
                return @db.q "ROLLBACK"

            throw code: 'migration_add', name: name, err: e


module.exports = Migrator
