// app.js (CommonJS)

const express = require("express");
const cors = require("cors");
const db = require("./db/database");

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Crear tabla de citas si no existe (antes de levantar el servidor)
db.run(`
  CREATE TABLE IF NOT EXISTS citas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL,
    servicio TEXT NOT NULL,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL
  )
`);

// ========================================
// CREACION DEL CRUD
// INGRESAR LAS CITAS REQUERIDAS POR EL CLIENTE O ADMINISTRADOS
// ========================================
app.get("/", (req, res) => {
  res.send("API Barberia funcionando");
});

// Ruta de prueba para verificar SQLite
app.get("/test-db", (req, res) => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Listar todas las citas
app.get("/api/citas", (req, res) => {
  db.all("SELECT * FROM citas ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ===============================
// CREAR CITA (CREATE)
// Endpoint: POST /api/citas
// Recibe datos del cliente y guarda una nueva cita en SQLite
// ===============================

// Crear una cita
app.post("/api/citas", (req, res) => {
  const { cliente, servicio, fecha, hora } = req.body;

  // Validacion basica
  if (!cliente || !servicio || !fecha || !hora) {
    return res.status(400).json({
      error: "Faltan campos obligatorios: cliente, servicio, fecha, hora",
    });
  }

  const sql = `
    INSERT INTO citas (cliente, servicio, fecha, hora)
    VALUES (?, ?, ?, ?)
  `;

  db.run(sql, [cliente, servicio, fecha, hora], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    // this.lastID trae el id generado
    res.status(201).json({
      id: this.lastID,
      cliente,
      servicio,
      fecha,
      hora,
    });
  });
});

// ========================================
// LISTAR TODAS LAS CITAS
// Endpoint: GET /api/citas
// ========================================
app.get("/api/citas/:id", (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM citas WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!row) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    res.json(row);
  });
});

// ========================================
// INGRESO DE DATOS REQUERIDOS
// ========================================
app.put("/api/citas/:id", (req, res) => {
  const { id } = req.params;
  const { cliente, servicio, fecha, hora } = req.body;

  if (!cliente || !servicio || !fecha || !hora) {
    return res.status(400).json({
      error: "Faltan campos obligatorios: cliente, servicio, fecha, hora",
    });
  }

  const sql = `
    UPDATE citas
    SET cliente = ?, servicio = ?, fecha = ?, hora = ?
    WHERE id = ?
  `;

  db.run(sql, [cliente, servicio, fecha, hora, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    if (this.changes === 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    res.json({ id: Number(id), cliente, servicio, fecha, hora });
  });
});

// ========================================
// MOSTRAR LAS CITAS BORRADAS
// Endpoint: DELETE /api/citas
// ========================================
app.delete("/api/citas/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM citas WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    if (this.changes === 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    res.json({ mensaje: "Cita eliminada correctamente", id: Number(id) });
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Prueba SQLite en http://localhost:${PORT}/test-db`);
});