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

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Travel backend API running on http://localhost:${port}`);
});
