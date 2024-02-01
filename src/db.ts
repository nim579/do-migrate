import pg from 'pg';

export type DBConfig = pg.PoolConfig;
export interface DBTransactionQuery<Result, D extends DB> { (db: D): Promise<Result> }

export class DB {
	protected _pool: pg.Pool;
	protected _conn: pg.PoolClient;

	DBTransaction = DBTransaction;

	constructor(config: pg.PoolClient)
	constructor(config: DBConfig, name: string)
	constructor(config: DBConfig | pg.PoolClient, name = 'dev') {
		this.initialize(config, name);
	}

	protected get pool() {
		return this._conn || this._pool;
	}

	protected get defaults(): DBConfig {
		return {
			host: 'localhost',
			port: 5432,
			user: 'postgres',
			password: 'postgres',
			database: 'postgres',
		};
	}

	protected initialize(config: DBConfig | pg.PoolClient, application_name?: string) {
		if ('on' in config) {
			this._conn = config;
		} else {
			this._pool = new pg.Pool({
				...this.defaults,
				application_name,
				...config
			});
		}
	}

	async q<Result extends object>(query: { query: string, values?: any[] }): Promise<pg.QueryResult<Result>>
	async q<Result extends object>(query: string, values?: any[]): Promise<pg.QueryResult<Result>>
	async q<Result extends object = any>(query: string | { query: string, values?: any[] }, values?: any[]) {
		if (typeof query != 'string') {
			values = query.values || values;
			query = query.query;
		}

		const vals = Array.isArray(values)
			? values
			: [];

		return this.pool.query<Result>(query, vals);
	}

	async r<Result>(query: { query: string, values?: any[] }): Promise<Result[]>
	async r<Result>(query: string, values?: any[]): Promise<Result[]>
	async r<Result extends object>(query: string | { query: string, values?: any[] }, values?: any[]) {
		const { rows } = typeof query === 'string'
			? await this.q<Result>(query, values)
			: await this.q<Result>(query);

		return rows;
	}

	async transaction<Result>(
		runner: DBTransactionQuery<Result, InstanceType<this['DBTransaction']>>,
	) {
		const client = await this._pool.connect();

		try {
			await client.query('BEGIN');

			const transaction = new this.DBTransaction(client) as InstanceType<this['DBTransaction']>;

			const result = await runner(transaction);

			await client.query('COMMIT');
			client.release();

			return result;
		} catch (error) {
			await client.query('ROLLBACK');
			client.release();
			throw error;
		}
	}
}

export class DBTransaction extends DB {
	transaction() {
		return Promise.reject(
			new Error('Transaction into transaction is not possible')
		);
	}
}

export function sql(queryParts: TemplateStringsArray, ...vars: any[]) {
	let query = '';
	const values: any[] = [];

	for (let index = 0; index < queryParts.length; index++) {
		query += queryParts[index];
		if (index < vars.length) {
			const num = values.push(values);
			query += '$' + num;
		}
	}

	return { query, values };
}

