if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === "[object Array]";
  };
}

function createMigrTableSql(table) {
  return `CREATE TABLE IF NOT EXISTS ${table} (id INTEGER PRIMARY KEY, name TEXT NOT NULL, up TEXT NOT NULL, down TEXT NOT NULL)`;
}

async function querySql(sql, params = []) {
  return true;
}

async function execLog(debug = false, fn, ...params) {
  if (!!debug) {
    console.log(`:: migr query :: ${fn.name} ::`, ...params);
  }

  return await fn(...params);
}

export default async function migr(options) {
  const adp = {
    debug: false,
    table: "__migr",
    migrations: [],
    createTable: createMigrTableSql,
    query: querySql,
    run: querySql,
    force: null,
    results: [],
    ...options,
  };

  const migrations = (typeof adp.migrations === "function" ? adp.migrations({ table: adp.table }) : adp.migrations)
    .filter(x => !!x.name && /^(\d+)(.*?)$/.test(x.name))
    .map(migration => {
      const migrationName = migration.name.match(/^(\d+)(.*?)$/);
      if (!migration.migrationUp && !!migration.migration) {
        if (typeof migration.migration === "string") {
          const [up, down] = migration.migration.split(/^--\s+?down\b/im);
          if (!!up) {
            migration.migrationUp = up.replace(/^-- .*?$/gm, "").trim(); // Remove comments
            if (!!down) {
              migration.migrationDown = down.trim(); // and trim whitespaces
            }
          }
        } else if (Array.isArray(migration.migration)) {
          migration.migrationUp = migration.migration;
        }
        delete migration.migration;
      }
      return { id: Number(migrationName[1]), ...migration };
    })
    .filter(x => !!x.migrationUp)
    .sort((a, b) => Math.sign(a.id - b.id));

  if (!migrations.length) {
    return true;
  }

  await execLog(adp.debug, adp.run, adp.createTable(adp.table));

  // Get the list of already applied migrations
  let dbMigrations = await execLog(adp.debug, adp.query, `SELECT id, name, up, down FROM ${adp.table} ORDER BY id ASC`);
  if (!!dbMigrations) {
    if (!Array.isArray(dbMigrations) && "rows" in dbMigrations) {
      const dbMigrationsArr = [];
      for (let j = 0; j < dbMigrations.rows.length; j++) {
        dbMigrationsArr.push(dbMigrations.rows.item(j));
      }
      dbMigrations = dbMigrationsArr;
    }
  } else {
    dbMigrations = [];
  }

  adp.results = migrations.reduce((acc, k) => ({ ...acc, [k.name]: false }), {});

  // Undo migrations that exist only in the database but not in files,
  // also undo the last migration if the `adp.force` option was set to `last`.
  const lastMigration = migrations[migrations.length - 1];
  for (const migration of dbMigrations.slice().sort((a, b) => Math.sign(+b.id - +a.id))) {
    if (!migrations.some(x => +x.id === +migration.id) || (adp.force === "last" && migration.id === lastMigration.id)) {
      if (!!migration.down) {
        await execLog(adp.debug, adp.run, "BEGIN");
        try {
          const down = JSON.parse(migration.down);
          if (!!down) {
            await execLog(adp.debug, adp.run, down);
            await execLog(adp.debug, adp.run, `DELETE FROM "${adp.table}" WHERE id = ?`, [migration.id]);
          }
          await execLog(adp.debug, adp.run, "COMMIT");
          dbMigrations = dbMigrations.filter(x => +x.id !== +migration.id);
        } catch (err) {
          await execLog(adp.debug, adp.run, "ROLLBACK");
          throw err;
        }
      } else {
        dbMigrations = dbMigrations.filter(x => +x.id !== +migration.id);
      }
    } else {
      adp.results[migration.name] = true;
    }
  }

  // Apply pending migrations
  const lastMigrationId = dbMigrations.length ? dbMigrations[dbMigrations.length - 1].id : 0;
  for (const migration of migrations) {
    if (migration.id > +lastMigrationId && !!migration.migrationUp) {
      await execLog(adp.debug, adp.run, "BEGIN");
      try {
        if (typeof migration.migrationUp === "string") {
          await execLog(adp.debug, adp.run, migration.migrationUp);
        } else if (Array.isArray(migration.migrationUp) && migration.migrationUp.length > 0) {
          for (let i = 0; i < migration.migrationUp.length; i++) {
            await execLog(adp.debug, adp.run, migration.migrationUp[i]);
          }
        }
        await execLog(adp.debug, adp.run, `INSERT INTO ${adp.table} (id, name, up, down) VALUES (?, ?, ?, ?)`, [
          migration.id,
          migration.name,
          JSON.stringify(migration.migrationUp),
          !!migration.migrationDown ? JSON.stringify(migration.migrationDown) : "",
        ]);
        await execLog(adp.debug, adp.run, "COMMIT");

        adp.results[migration.name] = true;
      } catch (err) {
        await execLog(adp.debug, adp.run, "ROLLBACK");
        throw err;
      }
    }
  }

  return adp.results;
}
