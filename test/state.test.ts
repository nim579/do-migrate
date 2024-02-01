import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DB } from '../src/db.js';
import { Migration, State, hash } from '../src/state.js';
import * as config from '../src/config.js';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class MockedDB extends DB {
	requests: { query: string; values: any[]; }[] = [];

	mocks: { query: string; values: any[]; result: any }[] = [];

	initialize() { }

	q<Result extends object>(query: { query: string; values?: any[] | undefined; }): Promise<pg.QueryResult<Result>>;
	q<Result extends object>(query: string, values?: any[] | undefined): Promise<pg.QueryResult<Result>>;
	q<Result extends object = any>(query: string | { query: string; values?: any[] | undefined; }, values?: any[] | undefined): Promise<pg.QueryResult<Result>> {
		if (typeof query != 'string') {
			values = query.values || values;
			query = query.query;
		}

		const vals = Array.isArray(values)
			? values
			: [];

		this.requests.push({ query, values: vals });

		const mock = this.mocks.find(mock => mock.query === query && JSON.stringify(vals) === JSON.stringify(mock.values));

		const result: pg.QueryResult<Result> = {
			rows: mock?.result || [],
			rowCount: mock?.result.length || 0,
			command: query,
			fields: [],
			oid: 0
		};

		return Promise.resolve(result);
	}
}

describe('State', () => {
	it('constructor', async () => {
		const schema = `schema_${Math.floor(Math.random() * 100000)}`;
		const table = `table_${Math.floor(Math.random() * 100000)}`;

		const db = new MockedDB(config.db, 'init');
		db.mocks = [
			{
				query: `SELECT * FROM "${schema}"."${table}" ORDER BY exec_date`,
				values: [],
				result: [
					{
						name: 'initial',
						do_hash: hash('CREATE TABLE test (id: int);'), do_sql: 'CREATE TABLE test (id: int);',
						undo_hash: hash('DROP TABLE test;'), undo_sql: 'DROP TABLE test;',
						exec_date: new Date(),
					},
				],
			},
		];

		const state = new State(db, {
			path: path.resolve(__dirname, './migrations'),
			order_file: 'order',
			schema,
			table,
		});

		const result = await new Promise(resolve => {
			state.isReady.then(result => resolve(result));
			setTimeout(() => resolve(false), 10000).unref();
		});

		assert.equal(result, true);

		assert.equal(state.tableName, `"${schema}"."${table}"`);
		assert.notEqual(state.tableByName['initial'], null);
		assert.equal(state.tableByName['some_fix'], null);
		assert.notEqual(state.migrationsByName['initial'], null);
		assert.notEqual(state.migrationsByName['some_fix'], null);

		assert.equal(state.table[0]?.name, 'initial');
		assert.equal(state.table[1]?.name, null);
		assert.equal(state.migrations[0]?.name, 'initial');
		assert.equal(state.migrations[1]?.name, 'some_fix');
		assert.equal(state.migrations[2]?.name, null);

		assert.equal(state.table[0]?.do.sql, 'CREATE TABLE test (id: int);');
		assert.equal(state.migrations[0]?.do.sql, 'CREATE TABLE test (\n\tkey varchar(255) UNIQUE,\n\tvalue text\n);\n');
		assert.equal(state.table[0]?.undo.sql, 'DROP TABLE test;');
		assert.equal(state.migrations[0]?.undo.sql, 'DROP TABLE test;\n');

		assert.equal(db.requests[1]?.query, `SELECT * FROM "${schema}"."${table}" ORDER BY exec_date`);
	});
});

describe('Migration', () => {
	it ('constructor', () => {
		const mig1 = new Migration('test', 'CREATE TABLE test (id: int);', 'DROP TABLE test;');

		assert.equal(mig1.name, 'test');
		assert.equal(mig1.sql.do, 'CREATE TABLE test (id: int);');
		assert.equal(mig1.sql.undo, 'DROP TABLE test;');
		assert.equal(mig1.hash.do, hash('CREATE TABLE test (id: int);'));
		assert.equal(mig1.hash.undo, hash('DROP TABLE test;'));
		assert.equal(mig1.do.sql, mig1.sql.do);
		assert.equal(mig1.undo.sql, mig1.sql.undo);
		assert.equal(mig1.do.hash, mig1.hash.do);
		assert.equal(mig1.undo.hash, mig1.hash.undo);

		const mig2 = new Migration('test2', 'CREATE TABLE test2 (id: int);', 'DROP TABLE test2;', 'do_fake', 'undo_fake');

		assert.equal(mig2.name, 'test2');
		assert.equal(mig2.sql.do, 'CREATE TABLE test2 (id: int);');
		assert.equal(mig2.sql.undo, 'DROP TABLE test2;');
		assert.equal(mig2.hash.do, 'do_fake');
		assert.equal(mig2.hash.undo, 'undo_fake');
	});
});
