import envConfig from './config.js';
import { DB } from './db.js';
import { Migrator as Process, Action } from './migrator.js';
import { State, Migration } from './state.js';

export default class Migrator {
	process: Process;

	constructor(userConf?: typeof envConfig) {
		const config = userConf || envConfig;
		const db = new DB(config.db, 'migrator');
		const state = new State(db, config.migrations);

		this.process = new Process(db, state);
	}

	inspect() {
		return this.process.inspect();
	}

	migrate(
		notify?: (action: { name: string; action: Action, success: boolean }) => void,
		userActions?: { name: string; action: Action }[]
	) {
		return this.process.migrate(notify, userActions);
	}
}

export type Config = typeof envConfig;

export {
	Process,
	State,
	Action,
	Migration,
};
