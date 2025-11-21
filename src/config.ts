import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DBConfig } from './db.js';
import { StateConfig } from './state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV) {
	dotenv.config({ path: `.env.${process.env.NODE_ENV}.local` });
	dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
}

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

export function get<T = string | number | boolean | null>(name: string, def?: null): T
export function get<T = string | number | boolean | null>(name: string, def: T): T
export function get<T = string | number | boolean | null>(name: string, def: T): T {
	const value = process.env[name] != null
		? process.env[name]
		: def != null
			? def
			: null;

	if (value && typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch (e) {
			return value as T;
		}
	} else {
		return value as T;
	}
}

export const db: DBConfig = {
	host: get('MIGRATOR_DB_HOST', 'localhost'),
	port: get('MIGRATOR_DB_PORT', 5432),
	user: get('MIGRATOR_DB_USER', 'postgres'),
	password: get('MIGRATOR_DB_PASSWORD', ''),
	database: get('MIGRATOR_DB_DATABASE', 'postgres'),
	ssl: get<boolean>('MIGRATOR_DB_SSL', false)
		? {
			rejectUnauthorized: get<boolean>('MIGRATOR_DB_SSL_CHECK', false),
			ca: get<string>('MIGRATOR_DB_SSL_CA', undefined),
		}
		: false,
};

export const migrations: StateConfig = {
	path: get('MITRATOR_FILES_PATH', path.resolve(__dirname, '../migrations')),
	order_file: get('MITRATOR_ORDER_FILE', 'order'),
	schema: get('MIGRATOR_DB_SCHEMA_NAME', 'public'),
	table: get('MIGRATOR_TABLE_NAME', 'schema_versions'),
};

export default { db, migrations };
