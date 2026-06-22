require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.error("Missing JWT_SECRET in .env");
  process.exit(1);
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    jwtSecret,
    {
      expiresIn: "7d",
    }
  );
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Missing or invalid Authorization header",
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT now() AS time");

    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].time,
    });
  } catch (err) {
    console.error("Database health check failed:", err);

    res.status(500).json({
      status: "error",
      database: "not connected",
      message: err.message,
    });
  }
});

/* =========================
   AUTH ROUTES
========================= */

app.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, created_at
      `,
      [normalizedEmail, passwordHash]
    );

    const user = userResult.rows[0];

    await pool.query(
      `
      INSERT INTO profiles (id, display_name, default_currency)
      VALUES ($1, $2, $3)
      `,
      [user.id, displayName || null, "USD"]
    );

    const token = createToken(user);

    res.status(201).json({
      user,
      token,
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    console.error("Signup failed:", err);

    res.status(500).json({
      error: "Signup failed",
      message: err.message,
    });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT id, email, password_hash, created_at
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = createToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      token,
    });
  } catch (err) {
    console.error("Login failed:", err);

    res.status(500).json({
      error: "Login failed",
      message: err.message,
    });
  }
});

app.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.email,
        u.created_at,
        p.display_name,
        p.default_currency
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = $1
      `,
      [req.user.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json({
      user,
    });
  } catch (err) {
    console.error("Get current user failed:", err);

    res.status(500).json({
      error: "Get current user failed",
      message: err.message,
    });
  }
});

/* =========================
   TRIP ROUTES
========================= */

app.get("/trips", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        name,
        destination,
        currency,
        budget_amount,
        start_date,
        end_date,
        created_at,
        updated_at
      FROM trips
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.userId]
    );

    res.json({
      trips: result.rows,
    });
  } catch (err) {
    console.error("List trips failed:", err);

    res.status(500).json({
      error: "List trips failed",
      message: err.message,
    });
  }
});

app.get("/trips/:id", requireAuth, async (req, res) => {
  console.log("GET /trips/:id", {
    tripId: req.params.id,
    userId: req.user.userId,
  });

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        name,
        destination,
        currency,
        budget_amount,
        start_date,
        end_date,
        created_at,
        updated_at
      FROM trips
      WHERE id = $1
        AND user_id = $2
      `,
      [req.params.id, req.user.userId]
    );

    const trip = result.rows[0];

    if (!trip) {
      return res.status(404).json({
        error: "Trip not found",
      });
    }

    res.json({
      trip,
    });
  } catch (err) {
    console.error("Get trip failed:", err);

    res.status(500).json({
      error: "Get trip failed",
      message: err.message,
    });
  }
});

app.post("/trips", requireAuth, async (req, res) => {
  try {
    const {
      name,
      destination,
      currency,
      budget_amount,
      start_date,
      end_date,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "Trip name is required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO trips (
        user_id,
        name,
        destination,
        currency,
        budget_amount,
        start_date,
        end_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        user_id,
        name,
        destination,
        currency,
        budget_amount,
        start_date,
        end_date,
        created_at,
        updated_at
      `,
      [
        req.user.userId,
        name,
        destination || null,
        currency || "USD",
        budget_amount || 0,
        start_date || null,
        end_date || null,
      ]
    );

    res.status(201).json({
      trip: result.rows[0],
    });
  } catch (err) {
    console.error("Create trip failed:", err);

    res.status(500).json({
      error: "Create trip failed",
      message: err.message,
    });
  }
});

app.delete("/trips/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM trips
      WHERE id = $1
        AND user_id = $2
      RETURNING id
      `,
      [req.params.id, req.user.userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        error: "Trip not found",
      });
    }

    res.json({
      deleted: true,
    });
  } catch (err) {
    console.error("Delete trip failed:", err);

    res.status(500).json({
      error: "Delete trip failed",
      message: err.message,
    });
  }
});

/* =========================
   EXPENSE ROUTES
========================= */

app.get("/trips/:id/expenses", requireAuth, async (req, res) => {
  try {
    const tripCheck = await pool.query(
      `
      SELECT id
      FROM trips
      WHERE id = $1
        AND user_id = $2
      `,
      [req.params.id, req.user.userId]
    );

    if (!tripCheck.rows[0]) {
      return res.status(404).json({
        error: "Trip not found",
      });
    }

    const expensesResult = await pool.query(
      `
      SELECT
        id,
        user_id,
        trip_id,
        category_id,
        amount,
        currency,
        fx_rate_to_trip,
        amount_in_trip_currency,
        kind,
        note,
        spent_at,
        created_at
      FROM expenses
      WHERE trip_id = $1
        AND user_id = $2
      ORDER BY spent_at DESC, created_at DESC
      `,
      [req.params.id, req.user.userId]
    );

    const expenses = expensesResult.rows;

    if (!expenses.length) {
      return res.json({
        expenses: [],
      });
    }

    const expenseIds = expenses.map((expense) => expense.id);

    const itemsResult = await pool.query(
      `
      SELECT
        id,
        user_id,
        expense_id,
        description,
        amount,
        created_at
      FROM expense_items
      WHERE expense_id = ANY($1::uuid[])
        AND user_id = $2
      ORDER BY created_at ASC
      `,
      [expenseIds, req.user.userId]
    );

    const itemsByExpense = {};

    for (const item of itemsResult.rows) {
      if (!itemsByExpense[item.expense_id]) {
        itemsByExpense[item.expense_id] = [];
      }

      itemsByExpense[item.expense_id].push(item);
    }

    res.json({
      expenses: expenses.map((expense) => ({
        ...expense,
        expense_items: itemsByExpense[expense.id] || [],
      })),
    });
  } catch (err) {
    console.error("List expenses failed:", err);

    res.status(500).json({
      error: "List expenses failed",
      message: err.message,
    });
  }
});

app.post("/trips/:id/expenses", requireAuth, async (req, res) => {
  try {
    const {
      amount,
      currency,
      fx_rate_to_trip,
      amount_in_trip_currency,
      category_id,
      note,
      spent_at,
      kind,
      items,
    } = req.body;

    const tripCheck = await pool.query(
      `
      SELECT id
      FROM trips
      WHERE id = $1
        AND user_id = $2
      `,
      [req.params.id, req.user.userId]
    );

    if (!tripCheck.rows[0]) {
      return res.status(404).json({
        error: "Trip not found",
      });
    }

    const expenseResult = await pool.query(
      `
      INSERT INTO expenses (
        user_id,
        trip_id,
        category_id,
        amount,
        currency,
        fx_rate_to_trip,
        amount_in_trip_currency,
        kind,
        note,
        spent_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING
        id,
        user_id,
        trip_id,
        category_id,
        amount,
        currency,
        fx_rate_to_trip,
        amount_in_trip_currency,
        kind,
        note,
        spent_at,
        created_at
      `,
      [
        req.user.userId,
        req.params.id,
        category_id || null,
        amount,
        currency,
        fx_rate_to_trip || 1,
        amount_in_trip_currency || amount,
        kind || "expense",
        note || null,
        spent_at || new Date().toISOString(),
      ]
    );

    const expense = expenseResult.rows[0];

    const insertedItems = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.description && !item.amount) continue;

        const itemResult = await pool.query(
          `
          INSERT INTO expense_items (
            user_id,
            expense_id,
            description,
            amount
          )
          VALUES ($1,$2,$3,$4)
          RETURNING
            id,
            user_id,
            expense_id,
            description,
            amount,
            created_at
          `,
          [
            req.user.userId,
            expense.id,
            item.description || null,
            item.amount || 0,
          ]
        );

        insertedItems.push(itemResult.rows[0]);
      }
    }

    res.status(201).json({
      expense: {
        ...expense,
        expense_items: insertedItems,
      },
    });
  } catch (err) {
    console.error("Create expense failed:", err);

    res.status(500).json({
      error: "Create expense failed",
      message: err.message,
    });
  }
});

app.delete("/expenses/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `
      DELETE FROM expense_items
      WHERE expense_id = $1
        AND user_id = $2
      `,
      [req.params.id, req.user.userId]
    );

    const result = await pool.query(
      `
      DELETE FROM expenses
      WHERE id = $1
        AND user_id = $2
      RETURNING id
      `,
      [req.params.id, req.user.userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        error: "Expense not found",
      });
    }

    res.json({
      deleted: true,
    });
  } catch (err) {
    console.error("Delete expense failed:", err);

    res.status(500).json({
      error: "Delete expense failed",
      message: err.message,
    });
  }
});

app.post("/expenses/:id/items", requireAuth, async (req, res) => {
  try {
    const { description, amount } = req.body;

    const expenseCheck = await pool.query(
      `
      SELECT id
      FROM expenses
      WHERE id = $1
        AND user_id = $2
      `,
      [req.params.id, req.user.userId]
    );

    if (!expenseCheck.rows[0]) {
      return res.status(404).json({
        error: "Expense not found",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO expense_items (
        user_id,
        expense_id,
        description,
        amount
      )
      VALUES ($1,$2,$3,$4)
      RETURNING
        id,
        user_id,
        expense_id,
        description,
        amount,
        created_at
      `,
      [
        req.user.userId,
        req.params.id,
        description || null,
        amount || 0,
      ]
    );

    res.status(201).json({
      item: result.rows[0],
    });
  } catch (err) {
    console.error("Create expense item failed:", err);

    res.status(500).json({
      error: "Create expense item failed",
      message: err.message,
    });
  }
});

app.delete("/expense-items/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM expense_items
      WHERE id = $1
        AND user_id = $2
      RETURNING id
      `,
      [req.params.id, req.user.userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        error: "Expense item not found",
      });
    }

    res.json({
      deleted: true,
    });
  } catch (err) {
    console.error("Delete expense item failed:", err);

    res.status(500).json({
      error: "Delete expense item failed",
      message: err.message,
    });
  }
});

/* =========================
   START SERVER
========================= */

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Travel backend API running on http://localhost:${port}`);
});