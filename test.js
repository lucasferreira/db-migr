const migr = require("./dist/commonjs/index.js").default;
const timeout = ms => new Promise(res => setTimeout(res, ms));

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
    migration: `CREATE INDEX people_name ON people (name)`,
    migrationDown: `DROP INDEX people_name`,
  },
  {
    name: "003-create-field",
    migration: ["ALTER TABLE people ADD address VARCHAR(255)", "ALTER TABLE people ADD email VARCHAR(60)"],
  },
  {
    name: "004-create-index-email",
    migration: `CREATE INDEX people_email ON people ('email')`,
  },
];

migr({
  migrations,
  query: async (query, params = []) => {
    // fake query implementation with a little delay time...
    await timeout(1000);
    return [];
  },
  debug: true,
})
  .then(r => console.log(`done`, r))
  .catch(err => console.log(`global error`, err.message));
