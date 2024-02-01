import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command, Option } from '@commander-js/extra-typings';
import Migrator from './index.js';
import envConfig from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

const program = new Command()
	.version(pkg.version, '-v, --vers', 'output the current version')
	.description(pkg.description)
	.addOption(
		new Option('--exec', 'Execute migration. You must use this flag for run migrations')
	)
	.addOption(
		new Option('--host <host>', 'Database hostname')
			.env('MIGRATOR_DB_HOST')
			.default('localhost')
	)
	.addOption(
		new Option('--port <port>', 'Database port')
			.env('MIGRATOR_DB_PORT')
			.default(5432)
			.argParser(parseInt)
	)
	.addOption(
		new Option('--user <username>', 'Database user')
			.env('MIGRATOR_DB_USER')
	)
	.addOption(
		new Option('--password <password>', 'Database password')
			.env('MIGRATOR_DB_PASSWORD')
	)
	.addOption(
		new Option('--database <name>', 'Database name')
			.env('MIGRATOR_DB_DATABASE')
	)
	.addOption(
		new Option('--schema-table <name>', 'Migrator sync table name')
			.env('MIGRATOR_TABLE_NAME')
			.default('schema_versions')
	)
	.addOption(
		new Option('--schema-name <name>', 'Database schema name')
			.env('MIGRATOR_DB_SCHEMA_NAME')
			.default('public')
	)
	.addOption(
		new Option('--path <path>', 'Path to migrations files dir')
			.env('MITRATOR_FILES_PATH')
	)
	.parse(process.argv);

const cliConfig = program.opts();

const config: typeof envConfig = {
	db: {
		...envConfig.db,
	},
	migrations: {
		...envConfig.migrations,
	}
};

if (cliConfig.host) config.db.host = cliConfig.host;
if (cliConfig.port) config.db.port = cliConfig.port;
if (cliConfig.user) config.db.user = cliConfig.user;
if (cliConfig.password) config.db.password = cliConfig.password;
if (cliConfig.database) config.db.database = cliConfig.database;
if (cliConfig.schemaTable) config.migrations.table = cliConfig.schemaTable;
if (cliConfig.schemaName) config.migrations.schema = cliConfig.schemaName;
if (cliConfig.path) config.migrations.path = cliConfig.path;

const migragor = new Migrator(config);

function capitalize(text: string) {
	return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;
}

(async () => {
	if (cliConfig.exec) {
		await migragor.migrate(action => {
			// eslint-disable-next-line no-console
			console.log(`${capitalize(action.action)} migration "${action.name}":\t${action.success ? 'done' : 'failed'}`);
		});
	} else {
		await migragor.inspect().then(actions => {
			for (const action of actions) {
				// eslint-disable-next-line no-console
				console.log(`${capitalize(action.action)} migration "${action.name}"`);
			}
		});
	}

	process.exit(0);
})();

