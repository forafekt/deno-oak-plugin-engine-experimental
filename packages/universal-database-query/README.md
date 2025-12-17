# Universal Database Query (UDBQ)

This package provides a universal database query builder that can be used with any database.

```typescript
import { DatabaseProvider } from "./DatabaseProvider.ts";
import { DatabaseConfig } from "./types.ts";

// Example usage with universal syntax
export async function example() {
  // Configuration can be loaded from environment or config file
  const config: DatabaseConfig = {
    type: "mysql", // Could be dynamically determined
    host: "localhost",
    database: "myapp",
    username: "user",
    password: "password",
  };

  const db = new DatabaseProvider(config);
  await db.connect();

  // Universal query builder - works with any database
  const qb = db.createQueryBuilder();

  // Select query
  const users = await db.query(
    qb.select(["id", "name", "email"])
      .from("users")
      .where("active", "=", true)
      .and("age", ">", 18)
      .orderBy("name")
      .limit(10),
  );

  // Insert query
  await db.execute(
    qb.insertInto("users", {
      name: "John Doe",
      email: "john@example.com",
      age: 30,
    }),
  );

  // Update query
  await db.execute(
    qb.update("users", { last_login: new Date() })
      .where("id", "=", 1),
  );

  // Delete query
  await db.execute(
    qb.deleteFrom("users")
      .where("active", "=", false)
      .and("last_login", "<", new Date("2023-01-01")),
  );

  // Create table with universal schema
  await db.execute(
    qb.createTable("posts", {
      columns: [
        { name: "id", type: "INTEGER", autoIncrement: true },
        { name: "title", type: "TEXT", nullable: false },
        { name: "content", type: "TEXT" },
        { name: "user_id", type: "INTEGER", nullable: false },
        {
          name: "created_at",
          type: "DATETIME",
          defaultValue: "CURRENT_TIMESTAMP",
        },
      ],
      primaryKey: ["id"],
      foreignKeys: [
        { column: "user_id", referencedTable: "users", referencedColumn: "id" },
      ],
    }),
  );

  // Transaction example
  await db.transaction(async (tx, QueryBuilder) => {
    const qb1 = new QueryBuilder();
    await tx.execute(
      qb1.insertInto("users", { name: "Jane", email: "jane@example.com" })
        .build().sql,
      qb1.build().params,
    );

    const qb2 = new QueryBuilder();
    await tx.execute(
      qb2.update("user_stats", { total_users: "total_users + 1" })
        .build().sql,
      qb2.build().params,
    );
  });

  // Raw SQL for complex queries (when universal builder isn't enough)
  const complexResult = await db.rawQuery(
    `
      SELECT u.name, COUNT(p.id) as post_count
      FROM users u
      LEFT JOIN posts p ON u.id = p.user_id
      GROUP BY u.id, u.name
      HAVING COUNT(p.id) > ?
    `,
    [5],
  );

  await db.disconnect();
}
```