import { DB, DBTransactionQuery } from '../src/db.js';
import { State } from '../src/state.js';
import pg from 'pg';

export class MockedDB extends DB {
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

	transaction<Result>(runner: DBTransactionQuery<Result, InstanceType<this['DBTransaction']>>): Promise<Result> {
		const db = this as InstanceType<this['DBTransaction']>;
		return runner(db);
	}
}

export class MockedState extends State {
	async init() {
		return true;
	}
}
