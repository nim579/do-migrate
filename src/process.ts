import { DB } from './db.js';
import { State } from './state.js';

export enum Action {
	Skip = 'skip',
	Shrink = 'shrink',
	Remove = 'remove',
	Change = 'change',
	Add = 'add',
}

function sleep(time = 1) {
	return new Promise(resolve => setTimeout(resolve, time));
}

export class Process {
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

		const skipActions: typeof state = [];
		const removeActions: typeof state = [];
		const addActions: typeof state = [];
		let diffIndex = 0;

		while (diffIndex < table.length && diffIndex < migrations.length) {
			if (table[diffIndex] === migrations[diffIndex] &&
				this.state.tableByName[table[diffIndex]]?.hash.do === this.state.migrationsByName[migrations[diffIndex]]?.hash.do) {
				skipActions.push({ name: table[diffIndex], action: Action.Skip });
				diffIndex++;
			} else {
				break;
			}
		}

		for (let i = diffIndex; i < table.length; i++) {
			removeActions.unshift({ name: table[i], action: Action.Remove });
		}

		for (let i = diffIndex; i < migrations.length; i++) {
			addActions.push({ name: migrations[i], action: Action.Add });
		}

		return [...state, ...skipActions, ...removeActions, ...addActions];
	}

	async migrate(
		notify?: (action: { name: string; action: Action, success: boolean }) => void,
		userActions?: { name: string; action: Action }[]
	) {
		const actions = userActions || await this.inspect();

		await this.db.transaction(async db => {
			for (const item of actions) {
				await sleep(100); // Skip some time for exec date gap

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

		await db.q(/*sql*/`
			INSERT INTO ${this.state.tableName} (name, do_sql, do_hash, undo_sql, undo_hash, exec_date)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, [
			name,
			migration.do.sql, migration.do.hash,
			migration.undo.sql, migration.undo.hash,
			new Date(),
		]);
	}

	private async change(name: string, db = this.db) {
		const current = this.state.tableByName[name];
		const migration = this.state.migrationsByName[name];

		if (current)
			await db.q(current.sql.undo);

		if (migration)
			await db.q(migration.sql.do);

		await db.q(/*sql*/`
			UPDATE ${this.state.tableName}
			SET
				do_sql = $2,
				do_hash = $3,
				undo_sql = $4,
				undo_hash = $5,
				exec_date = $6
			WHERE name = $1
		`, [
			name,
			migration.do.sql, migration.do.hash,
			migration.undo.sql, migration.undo.hash,
			new Date(),
		]);
	}
}
