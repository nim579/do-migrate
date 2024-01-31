import { DB } from './db.js';
import { State } from './state.js';

export enum Action {
	Skip = 'skip',
	Shrink = 'shrink',
	Remove = 'remove',
	Change = 'change',
	Add = 'add',
}

export class Migrator {
	db: DB;
	state: State;

	constructor(db: DB, state: State) {
		this.db = db;
		this.state = state;
	}

	async inspect() {
		await this.state.isReady;

		const table = this.state.table.map(item => item.name);
		const migrations = this.state.migrations.map(item => item.name);

		const state: { name: string; action: Action }[] = [];

		if (migrations.length === 0) {
			table.forEach(name => {
				state.push({ name, action: Action.Remove });
			});
		}

		const shrinkIndex = table.indexOf(migrations[0]);

		if (shrinkIndex >= 0)
			table.splice(0, shrinkIndex).forEach(name => {
				state.push({ name, action: Action.Shrink });
			});

		let differenceFound = false;
		let iCur = 0;
		let iNew = 0;

		while (iCur < table.length && iNew < migrations.length) {
			const current = this.state.tableByName[table[iCur]];
			const next = this.state.migrationsByName[migrations[iNew]];

			if (differenceFound || current.name !== next.name || current.hash.do !== next.hash.do) {
				differenceFound = true;
				state.push({ name: current.name, action: Action.Remove });
				iCur++;
			} else {
				state.push({ name: current.name, action: Action.Skip });
				iCur++;
				iNew++;
			}
		}

		while (iCur < table.length) {
			state.push({ name: table[iCur], action: Action.Remove });
			iCur++;
		}
		while (iNew < migrations.length) {
			state.push({ name: migrations[iNew], action: Action.Add });
			iNew++;
		}

		return state;
	}

	async migrate(
		notify?: (action: { name: string; action: Action, success: boolean }) => void,
		userActions?: { name: string; action: Action }[]
	) {
		const actions = userActions || await this.inspect();

		await this.db.transaction(async db => {
			for (const item of actions) {
				try {
					switch (item.action) {
					case Action.Remove:
						await this.remove(item.name, db);
						break;
					case Action.Add:
						await this.add(item.name, db);
						break;
					case Action.Change:
						await this.change(item.name, db);
						break;
					}

					if (notify) notify({ ...item, success: true });
				} catch (error) {
					if (notify) notify({ ...item, success: false });
					throw error;
				}
			}
		});
	}

	private async remove(name: string, db = this.db) {
		const current = this.state.tableByName[name];

		if (current)
			await db.q(current.sql.undo);

		await db.q(`DELETE FROM ${this.state.tableName} WHERE name = $1`, [name]);
	}

	private async add(name: string, db = this.db) {
		const migration = this.state.migrationsByName[name];

		if (migration)
			await db.q(migration.sql.do);

		await db.q(`
			INSERT INTO ${this.state.tableName} (name, do_sql, do_hash, undo_sql, undo_hash)
			VALUES ($1, $2, $3, $4, $5)
		`, [
			name,
			migration.do.sql, migration.do.hash,
			migration.undo.sql, migration.undo.hash,
		]);
	}

	private async change(name: string, db = this.db) {
		const current = this.state.tableByName[name];
		const migration = this.state.migrationsByName[name];

		if (current)
			await db.q(current.sql.undo);

		if (migration)
			await db.q(migration.sql.do);

		await db.q(`
			UPDATE ${this.state.tableName}
			SET
				do_sql = $2,
				do_hash = $3,
				undo_sql = $4,
				undo_hash = $5,
				exec_date = now()
			WHERE name = $1
		`, [
			name,
			migration.do.sql, migration.do.hash,
			migration.undo.sql, migration.undo.hash,
		]);
	}
}
