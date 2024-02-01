import assert from 'node:assert';
import { Action, Process } from '../src/process.js';
import { Migration } from '../src/state.js';
import * as config from '../src/config.js';
import { MockedDB, MockedState } from './mocks.js';


let db = new MockedDB(config.db, 'fake');
let state = new MockedState(db, config.migrations);

describe('Process', () => {
	before(() => {
		db = new MockedDB(config.db, 'fake');
		state = new MockedState(db, config.migrations);
	});

	describe('inspect()', () => {
		it('No changes', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
			];
			state.migrations = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Skip },
					{ name: '2', action: Action.Skip },
					{ name: '3', action: Action.Skip },
				],
				'Wrong actions order'
			);
		});

		it('Shrink', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];
			state.migrations = [
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Shrink },
					{ name: '2', action: Action.Shrink },
					{ name: '3', action: Action.Skip },
					{ name: '4', action: Action.Skip },
					{ name: '5', action: Action.Skip },
				],
				'Wrong actions order'
			);
		});

		it('Add', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
			];
			state.migrations = [
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Shrink },
					{ name: '2', action: Action.Shrink },
					{ name: '3', action: Action.Skip },
					{ name: '4', action: Action.Add },
					{ name: '5', action: Action.Add },
				],
				'Wrong actions order'
			);
		});

		it('Change simple', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];
			state.migrations = [
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5.1', '5'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Shrink },
					{ name: '2', action: Action.Shrink },
					{ name: '3', action: Action.Skip },
					{ name: '4', action: Action.Skip },
					{ name: '5', action: Action.Remove },
					{ name: '5', action: Action.Add },
				],
				'Wrong actions order'
			);
		});

		it('Change center', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];
			state.migrations = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3.1', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Skip },
					{ name: '2', action: Action.Skip },
					{ name: '5', action: Action.Remove },
					{ name: '4', action: Action.Remove },
					{ name: '3', action: Action.Remove },
					{ name: '3', action: Action.Add },
					{ name: '4', action: Action.Add },
					{ name: '5', action: Action.Add },
				],
				'Wrong actions order'
			);
		});

		it('Add center', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];
			state.migrations = [
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('6', '6', '6'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Shrink },
					{ name: '2', action: Action.Skip },
					{ name: '3', action: Action.Skip },
					{ name: '5', action: Action.Remove },
					{ name: '4', action: Action.Remove },
					{ name: '6', action: Action.Add },
					{ name: '4', action: Action.Add },
					{ name: '5', action: Action.Add },
				],
				'Wrong actions order'
			);
		});

		it('Remove center', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];
			state.migrations = [
				new Migration('2', '2', '2'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Shrink },
					{ name: '2', action: Action.Skip },
					{ name: '5', action: Action.Remove },
					{ name: '4', action: Action.Remove },
					{ name: '3', action: Action.Remove },
					{ name: '4', action: Action.Add },
					{ name: '5', action: Action.Add },
				],
				'Wrong actions order'
			);
		});

		it('Swap end', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];
			state.migrations = [
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('5', '5', '5'),
				new Migration('4', '4', '4'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Shrink },
					{ name: '2', action: Action.Skip },
					{ name: '3', action: Action.Skip },
					{ name: '5', action: Action.Remove },
					{ name: '4', action: Action.Remove },
					{ name: '5', action: Action.Add },
					{ name: '4', action: Action.Add },
				],
				'Wrong actions order'
			);
		});

		it('Swap center', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];
			state.migrations = [
				new Migration('2', '2', '2'),
				new Migration('4', '4', '4'),
				new Migration('3', '3', '3'),
				new Migration('5', '5', '5'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Shrink },
					{ name: '2', action: Action.Skip },
					{ name: '5', action: Action.Remove },
					{ name: '4', action: Action.Remove },
					{ name: '3', action: Action.Remove },
					{ name: '4', action: Action.Add },
					{ name: '3', action: Action.Add },
					{ name: '5', action: Action.Add },
				],
				'Wrong actions order'
			);
		});

		it('Mixed', async () => {
			const migrator = new Process(db, state);

			state.table = [
				new Migration('1', '1', '1'),
				new Migration('2', '2', '2'),
				new Migration('3', '3', '3'),
				new Migration('4', '4', '4'),
				new Migration('5', '5', '5'),
			];
			state.migrations = [
				new Migration('2', '2', '2'),
				new Migration('4', '4.1', '4.2'),
				new Migration('5', '5', '5'),
				new Migration('6', '6', '6'),
			];

			const result = await migrator.inspect();

			assert.deepEqual(
				result,
				[
					{ name: '1', action: Action.Shrink },
					{ name: '2', action: Action.Skip },
					{ name: '5', action: Action.Remove },
					{ name: '4', action: Action.Remove },
					{ name: '3', action: Action.Remove },
					{ name: '4', action: Action.Add },
					{ name: '5', action: Action.Add },
					{ name: '6', action: Action.Add },
				],
				'Wrong actions order'
			);
		});
	});

	describe('migrate()', () => {
		it('standard', async () => {
			const db = new MockedDB(config.db, 'fake');
			const state = new MockedState(db, config.migrations);
			const migrator = new Process(db, state);

			state.table = [
				new Migration('test1', 'create table test1 (id int);', 'drop table test1;'),
				new Migration('test2', 'create table test2 (id int);', 'drop table test2;'),
				new Migration('test3', 'create table test3 (id int);', 'drop table test3;'),
				new Migration('test4', 'create table test4 (id int);', 'drop table test4;'),
				new Migration('test5', 'create table test5 (id int);', 'drop table test5;'),
			];
			state.migrations = [
				new Migration('test2', 'create table test2 (id int);', 'drop table test2;'),
				new Migration('test4', 'create table test4 (id varchar);', 'drop table test4;'),
				new Migration('test5', 'create table test5 (id int);', 'drop table test5;'),
				new Migration('test6', 'create table test6 (id int);', 'drop table test5;'),
			];

			const actions: { name: string; action: Action, success: boolean }[] = [];

			await migrator.migrate(action => {
				actions.push(action);
			});

			assert.deepEqual(actions, [
				{ name: 'test1', action: Action.Shrink, success: true },
				{ name: 'test2', action: Action.Skip, success: true },
				{ name: 'test5', action: Action.Remove, success: true },
				{ name: 'test4', action: Action.Remove, success: true },
				{ name: 'test3', action: Action.Remove, success: true },
				{ name: 'test4', action: Action.Add, success: true },
				{ name: 'test5', action: Action.Add, success: true },
				{ name: 'test6', action: Action.Add, success: true },
			]);
		});
	});
});
