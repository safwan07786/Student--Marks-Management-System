require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the HTML pages and style.css from this same project folder.
app.use(express.static(__dirname));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "studentdb",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// GET /students - list all students
app.get("/students", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT student_id, student_name, total FROM students ORDER BY student_id"
    );
    res.json(rows);
  } catch (error) {
    console.error("GET /students:", error.message);
    res.status(500).json({ error: "Could not load students. Check database/table setup." });
  }
});

// GET /students/:sno - get one student. Return an array for compatibility with listOne.html.
app.get("/students/:sno", async (req, res) => {
  const sno = Number(req.params.sno);
  if (!Number.isInteger(sno) || sno <= 0) {
    return res.status(400).json({ error: "Student number must be a positive integer." });
  }
  try {
    const [rows] = await pool.execute(
      "SELECT student_id, student_name, total FROM students WHERE student_id = ?",
      [sno]
    );
    if (rows.length === 0) return res.json([]);
    res.json(rows);
  } catch (error) {
    console.error("GET /students/:sno:", error.message);
    res.status(500).json({ error: "Could not search student." });
  }
});

// POST /students - insert student; matches insert.html request body {sno, name, total}
app.post("/students", async (req, res) => {
  const sno = Number(req.body.sno);
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const total = Number(req.body.total);

  if (!Number.isInteger(sno) || sno <= 0) return res.status(400).send("Student number must be a positive integer.");
  if (!name) return res.status(400).send("Student name is required.");
  if (req.body.total === "" || req.body.total === undefined || !Number.isFinite(total) || total < 0) {
    return res.status(400).send("Total marks must be a non-negative number.");
  }

  try {
    await pool.execute(
      "INSERT INTO students (student_id, student_name, total) VALUES (?, ?, ?)",
      [sno, name, total]
    );
    res.status(201).send("Student inserted successfully.");
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).send("This student number already exists.");
    console.error("POST /students:", error.message);
    res.status(500).send("Could not insert student. Check database/table setup.");
  }
});

// PUT /students/:sno - update student. Supports {sno, name, total} from update.html.
app.put("/students/:sno", async (req, res) => {
  const sno = Number(req.params.sno);
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const total = Number(req.body.total);

  if (!Number.isInteger(sno) || sno <= 0) return res.status(400).send("Invalid student number.");
  if (!name) return res.status(400).send("Student name is required.");
  if (req.body.total === "" || req.body.total === undefined || !Number.isFinite(total) || total < 0) {
    return res.status(400).send("Total marks must be a non-negative number.");
  }

  try {
    const [result] = await pool.execute(
      "UPDATE students SET student_name = ?, total = ? WHERE student_id = ?",
      [name, total, sno]
    );
    if (result.affectedRows === 0) return res.status(404).send("Student not found or details are unchanged.");
    res.send("Student updated successfully.");
  } catch (error) {
    console.error("PUT /students/:sno:", error.message);
    res.status(500).send("Could not update student.");
  }
});

// DELETE /students/:sno - delete student
app.delete("/students/:sno", async (req, res) => {
  const sno = Number(req.params.sno);
  if (!Number.isInteger(sno) || sno <= 0) return res.status(400).send("Invalid student number.");
  try {
    const [result] = await pool.execute(
      "DELETE FROM students WHERE student_id = ?",
      [sno]
    );
    if (result.affectedRows === 0) return res.status(404).send("Student not found.");
    res.send("Student deleted successfully.");
  } catch (error) {
    console.error("DELETE /students/:sno:", error.message);
    res.status(500).send("Could not delete student.");
  }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

async function start() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log("Connected to MySQL database: " + (process.env.DB_NAME || "studentdb"));
    app.listen(PORT, () => {
      console.log(`Student Management app running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not connect to MySQL:", error.message);
    console.error("Check that MySQL Server is running and .env has the correct username/password/database.");
    process.exit(1);
  }
}

start();
