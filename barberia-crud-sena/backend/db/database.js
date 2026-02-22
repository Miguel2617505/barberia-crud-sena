// db/database.js

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Ruta absoluta al archivo barberia.db (en la carpeta backend)
const dbPath = path.join(__dirname, "..", "barberia.db");

// Abrir (o crear si no existe) la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al conectar con SQLite:", err.message);
  } else {
    console.log("Conexion SQLite OK ->", dbPath);
  }
});

module.exports = db;
