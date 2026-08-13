import test from "node:test";
import assert from "node:assert";
import app from "../server.js";
import { db, pool } from "../db.js";

test("Backend API routes mock tests", async (t) => {
  // Start server on dynamic port
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "string" ? 0 : address?.port;
  const baseUrl = `http://localhost:${port}`;

  // Mock users
  const mockUser = { id: 1, username: "testuser" };
  const mockLibrary = [{ userId: 1, gameId: "hextris" }];

  // Setup DB mocks
  (db.query.users as any).findFirst = async (options: any) => {
    if (options && options.where) {
      // Very basic mock checking
      return mockUser;
    }
    return null;
  };

  (db.query.library as any).findMany = async (options: any) => {
    return mockLibrary;
  };

  db.insert = ((table: any) => {
    return {
      values: (data: any) => {
        return {
          returning: async () => [mockUser],
          onConflictDoNothing: async () => {
            return Promise.resolve();
          }
        };
      }
    };
  }) as any;

  db.delete = ((table: any) => {
    return {
      where: (cond: any) => {
        return Promise.resolve();
      }
    };
  }) as any;

  await t.test("POST /api/v1/auth/login - valid user", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testuser" }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.username, "testuser");
    
    const cookie = res.headers.get("set-cookie");
    assert.ok(cookie && cookie.includes("userId=1"));
  });

  await t.test("POST /api/v1/auth/login - invalid body", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 400);
  });

  await t.test("GET /api/v1/auth/me - unauthorized when no cookie", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert.strictEqual(res.status, 401);
  });

  await t.test("GET /api/v1/auth/me - authorized with cookie", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Cookie: "userId=1",
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.username, "testuser");
  });

  await t.test("GET /api/v1/library - fetch library list", async () => {
    const res = await fetch(`${baseUrl}/api/v1/library`, {
      headers: {
        Cookie: "userId=1",
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, ["hextris"]);
  });

  await t.test("POST /api/v1/library - add game to library", async () => {
    const res = await fetch(`${baseUrl}/api/v1/library`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "userId=1",
      },
      body: JSON.stringify({ gameId: "pacman" }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, ["hextris"]); // mock library list stays same since we mocked findMany
  });

  await t.test("DELETE /api/v1/library/:gameId - delete game from library", async () => {
    const res = await fetch(`${baseUrl}/api/v1/library/hextris`, {
      method: "DELETE",
      headers: {
        Cookie: "userId=1",
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, ["hextris"]);
  });

  await t.test("POST /api/v1/auth/logout - clear cookie", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
    });

    assert.strictEqual(res.status, 200);
    const cookie = res.headers.get("set-cookie");
    assert.ok(cookie && cookie.includes("userId=;"));
  });

  server.close();
  await pool.end();
});
