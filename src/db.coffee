_  = require 'lodash'
pg = require 'pg'

class DB
    defaults: ->
        host: 'localhost'
        port: 5432
        user: null
        password: null
        database: null

    constructor: (user_config)->
        config = _.assign @defaults(), user_config

        unless config.host and config.port and config.database
            throw code: 'no_required_db_params', err: config

        @_pool = new pg.Pool config

    q: (query, values = [], callback)->
        if _.isFunction values
            callback = values
            values = []

        unless _.isArray values
            values = [values]

        new Promise (resolve, reject)=>
            @_pool.query query, values, (err = null, result)->
                if err
                    reject err

                else
                    resolve result

                callback? err, result

    destroy: ->
        @_pool.end()


module.exports = DB
