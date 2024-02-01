ALTER TABLE test ADD COLUMN is_json boolean NOT NULL DEFAULT false;

CREATE TABLE test2 (
	key varchar(255) UNIQUE,
	value text,
	published boolean NOT NULL DEFAULT false
);
