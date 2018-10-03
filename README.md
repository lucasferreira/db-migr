# db-migr

## Installation

Since the library is a JS-based solution, to install the latest version of `db-migr` you only need to run:

```bash
$ npm install --save db-migr
```

or

```bash
$ yarn add db-migr
```

## How it works

This tool implements a lightweight migrations API that works with a array of migrations as the follow example:

```javascript
const migrations = [
  {
    name: "001-create-table",
    migration: `
-- Up
CREATE TABLE IF NOT EXISTS "people" (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL
);

-- Down
DROP TABLE people;`,
  },
  {
    name: "002-create-index-name",
    migrationUp: `CREATE INDEX people_name ON people (name)`,
    migrationDown: `DROP INDEX people_name`,
  },
  {
    name: "003-create-field",
    migration: [
      "ALTER TABLE people ADD address VARCHAR(255)",
      "ALTER TABLE people ADD email VARCHAR(60)"
    ],
  },
  {
    name: "004-create-index-email",
    migration: `CREATE INDEX people_email ON people ('email')`,
  },
];
```

Each `migration` in your array could be based in a complex string, or using two attributes `migrationUp` and `migrationDown`. You could use in up operations some array of queries also.

### Implement your query runner

To make this tool more versatile *we didn't implement* a default _query runner_ method, so you can use this tool with your favorite database adapter just implementing some promisable/async _query_ function.

#### Simple generic example:

```javascript
import migr from "db-migr";

const myMigrations = [
  ...a incremental list of migrations for your db
];

const dbConn = ...implements your database connection

// run your migrations when you are sure that your db connection are already opened
migr({
  // implemention our query runner [required]
  query: async (query, params = []) => {
    return away dbConn.executeSql(query, params);
  },
  // pass your migrations
  migrations: myMigrations
}).then(() => {
  // if you got here, everything ran ok
}).catch(err => {
  // if you got here, something wrong happened
  // and you could look to `err` object
});
```

## License

[MIT](./LICENSE)
