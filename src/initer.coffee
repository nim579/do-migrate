_  = require 'lodash'
fs = require 'fs'
path   = require 'path'
crypto = require 'crypto'


class MirgatorIniter
    constructor: (@params, @db)->

    start: ->
        init = order: [], table: {}, files: {}

        Promise.resolve()
        .then =>
            @bootstrap()

        .then =>
            @getOrder()
            .then (data)-> init.order = data

        .then =>
            @getTable()
            .then (data)-> init.table = data

        .then =>
            @getMigrations init.order
            .then (data)-> init.files = data

        .then -> return init

    bootstrap: ->
        {schema_name, schema_table} = @params

        @db.q """
            CREATE TABLE IF NOT EXISTS #{schema_name}.#{schema_table} (
              name varchar(255) NOT NULL UNIQUE,
              do_hash varchar(64) NOT NULL,
              do_sql text NOT NULL,
              undo_hash varchar(64) NOT NULL,
              undo_sql text,
              exec_date timestamp with time zone NOT NULL DEFAULT now()
            )
        """
        .catch (err)-> throw code: 'create_table', err: err

    getOrder: ->
        migrations_list = path.resolve @params.migrations, @params.migrations_list

        new Promise (resolve, reject)->
            fs.readFile migrations_list, (err, list)->
                if err
                    reject err

                else
                    resolve list.toString()

        .then (list)->
            return list.split /\n/gm

    getTable: ->
        {schema_name, schema_table} = @params

        @db.q "SELECT * FROM #{schema_name}.#{schema_table}"
        .then ({rows})->
            table = {}

            _.forEach rows, (row)->
                table[row.name] = row

            return table

        .catch (err)-> throw code: 'get_table', err: err

    getMigrations: (list)->
        initer = @
        actions = @params.actions

        files = {}

        Promise.resolve()

        # Load migration files
        .then ->
            loaders = []

            _.forEach list, (name)->
                return unless name
                file = {name}

                _.forEach actions, (val, action)->
                    _file = initer._loadFile "#{name}.#{val}.sql"
                    .then (data)->
                        file["#{action}_sql"] = data
                        files[name] = file

                    .catch ->

                    loaders.push _file

            return Promise.all loaders

        # Set hashes
        .then ->
            loaders = []

            _.forEach files, (file)->
                _.forEach actions, (val, action)->
                    _hash = initer._hashFile file["#{action}_sql"]
                    .then (hash)-> file["#{action}_hash"] = hash

                    loaders.push _hash

            return Promise.all loaders

        .then ->
            return files

    _loadFile: (migrationName)->
        fileName = path.resolve @params.migrations, migrationName

        new Promise (resolve, reject)->
            fs.readFile fileName, (err, data)->
                if err
                    reject err

                else
                    resolve data.toString()

    _hashFile: (text)->
        new Promise (resolve, reject)->
            hash = crypto.createHash 'sha256'
            hash.update text, 'utf8'
            resolve hash.digest 'hex'


module.exports = MirgatorIniter
