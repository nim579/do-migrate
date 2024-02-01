import envConfig from './config.js';
import { DB } from './db.js';
import { Process, Action } from './process.js';
import { State, Migration } from './state.js';

export default class Migrator {
	process: Process;

	constructor(userConf?: { db?: Partial<typeof envConfig.db>; migrations: Partial<typeof envConfig.migrations> }) {
		const config = userConf
			? {
				db: { ...envConfig.db, ...userConf.db },
				migrations: { ...envConfig.migrations, ...userConf.migrations },
			}
			: envConfig;

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
