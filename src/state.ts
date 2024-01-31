import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DB } from './db.js';

export type VersionRecord = {
	name: string;
	do_hash: string;
	do_sql: string;
	undo_hash: string;
	undo_sql: string;
	exec_date: Date;
};

export type StateConfig = {
	path: string;
	order_file: string;
	schema: string;
	table: string;
};

export function hash(text: string) {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

export class Migration {
	private _name: string;
	private doSql: string;
	private undoSql: string;
	private doHash: string;
	private undoHash: string;

	constructor(name: string, doSql: string, undoSql: string, doHash?: string, undoHash?: string) {
		this._name = name;
		this.doSql = doSql;
		this.undoSql = undoSql;
		this.doHash = doHash || hash(doSql);
		this.undoHash = undoHash || hash(undoSql);
	}

	get name() {
		return this._name;
	}

	get sql() {
		return {
			do: this.doSql,
			undo: this.undoSql,
		};
	}

	get hash() {
		return {
			do: this.doHash,
			undo: this.undoHash,
		};
	}

	get do() {
		return {
			sql: this.doSql,
			hash: this.doHash,
		};
	}

	get undo() {
		return {
			sql: this.undoSql,
			hash: this.undoHash,
		};
	}
}

export class State {
	private order: string[];
	table: Migration[];
	migrations: Migration[];
	isReady: Promise<boolean>;

	get tableByName() {
		return this.table.reduce((mem, migration) => {
			mem[migration.name] = migration;
			return mem;
		}, {} as Record<string, Migration>);
	}
	get migrationsByName() {
		return this.migrations.reduce((mem, migration) => {
			mem[migration.name] = migration;
			return mem;
		}, {} as Record<string, Migration>);
	}

	get tableName() {
		const { schema, table } = this.config;
		return `"${schema}"."${table}"`;
	}

	constructor(private db: DB, private config: StateConfig) {
		this.db = db;
		this.config = config;

		this.isReady = this.init();
	}

	protected async init() {
		await this.initTable();
		await this.initOrder();
		await this.initMigrations();

		return true;
	}

	private async initTable() {
		await this.db.q(/*sql*/`
			CREATE TABLE IF NOT EXISTS ${this.tableName} (
				name varchar(255) NOT NULL UNIQUE,
				do_hash varchar(64) NOT NULL,
				do_sql text NOT NULL,
				undo_hash varchar(64) NOT NULL,
				undo_sql text,
				exec_date timestamp with time zone NOT NULL DEFAULT now()
			)
		`);

		const result = await this.db.r<VersionRecord>(`SELECT * FROM ${this.tableName} ORDER BY exec_date`);

		this.table = result.map(item => {
			return new Migration(item.name, item.do_sql, item.undo_sql, item.do_hash, item.undo_hash);
		});
	}

	private async initOrder() {
		const file = await this._loadFile(this.config.order_file);
		this.order = file.split('\n').filter(row => !!row);
	}

	private async initMigrations() {
		const migrations: Record<string, Migration> = {};

		await Promise.all(this.order.map(async name => {
			const doSql   = await this._loadFile(`${name}.do.sql`);
			const undoSql = await this._loadFile(`${name}.undo.sql`);

			migrations[name] = new Migration(name, doSql, undoSql);
		}));

		this.migrations = this.order.map(name => {
			return migrations[name];
		});
	}

	private _loadFile(fileName: string) {
		return readFile(
			path.resolve(this.config.path, fileName),
			'utf8'
		);
	}
}
