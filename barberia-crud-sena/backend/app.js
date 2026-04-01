require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const JWT_SECRET = "super_secreto_cambialo";
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/* =========================================
   CONEXION SQLITE
========================================= */

const dbPath = path.join(__dirname, "barberia.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Error abriendo SQLite:", err.message);
  else console.log("Conexion SQLite OK ->", dbPath);
});

/* =========================================
   CREACION DE TABLAS
========================================= */

db.serialize(() => {
  // Tabla citas
  db.run(`
    CREATE TABLE IF NOT EXISTS citas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL,
      servicio TEXT NOT NULL,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      multa INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.all(`PRAGMA table_info(citas)`, (err, columns) => {
    if (err) {
      console.error("Error revisando estructura:", err.message);
      return;
    }

    const existeClienteId = columns.some(col => col.name === "cliente_id");

    if (!existeClienteId) {
      db.run(`ALTER TABLE citas ADD COLUMN cliente_id INTEGER`, (alterErr) => {
        if (alterErr) {
          console.error("Error agregando cliente_id:", alterErr.message);
        } else {
          console.log(" Columna cliente_id agregada a citas");
        }
      });
    }

    const existeBarberoId = columns.some(col => col.name === "barbero_id");
    if (!existeBarberoId) {
      db.run(`ALTER TABLE citas ADD COLUMN barbero_id INTEGER`, (alterErr) => {
        if (alterErr) console.error("Error agregando barbero_id:", alterErr.message);
        else console.log("Columna barbero_id agregada a citas");
      });
    }
  });
});

// Evitar doble reserva (si no esta cancelada)
db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_citas_slot_activo
    ON citas (fecha, hora)
    WHERE estado != 'cancelada'
  `);

// Tabla usuarios
db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'cliente',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);


db.all(`PRAGMA table_info(usuarios)`, (err, columns) => {
  if (err) return;
  const hasCreatedAt = columns.some(col => col.name === "created_at");
  if (!hasCreatedAt) {
    db.run(`ALTER TABLE usuarios ADD COLUMN created_at TEXT DEFAULT ''`, (alterErr) => {
      if (alterErr) console.error("Error adding created_at:", alterErr.message);
      else console.log("Columna created_at agregada a usuarios");
    });
  }
});

// Añadir estado de pagos
db.all(`PRAGMA table_info(citas)`, (err, columns) => {
  if (err) return;
  const hasPaymentStatus = columns.some(col => col.name === "payment_status");
  if (!hasPaymentStatus) {
    db.run(`ALTER TABLE citas ADD COLUMN payment_status TEXT DEFAULT 'pending'`, (alterErr) => {
      if (alterErr) console.error("Error adding payment_status:", alterErr.message);
      else console.log("Columna payment_status agregada a citas");
    });
  }
  const hasStripeSessionId = columns.some(col => col.name === "stripe_session_id");
  if (!hasStripeSessionId) {
    db.run(`ALTER TABLE citas ADD COLUMN stripe_session_id TEXT`, (alterErr) => {
      if (alterErr) console.error("Error adding stripe_session_id:", alterErr.message);
      else console.log("Columna stripe_session_id agregada a citas");
    });
  }
});

// Tabla servicios
db.run(`
    CREATE TABLE IF NOT EXISTS servicios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      precio INTEGER NOT NULL
    )
  `, function () {
  // Servicios por defecto si la tabla esta vacia 
  db.get(`SELECT COUNT(*) AS total FROM servicios`, (err, row) => {
    if (err) return;
    if (row.total === 0) {
      const servicios = [
        ["Corte clásico", 20000],
        ["Corte + Barba", 28000],
        ["Afeitado con navaja", 10000],
        ["Diseño de cejas", 10000],
        ["Tinte de cabello", 60000],
        ["Corte infantil", 15000],
      ];
      const stmt = db.prepare(`INSERT INTO servicios (nombre, precio) VALUES (?, ?)`);
      servicios.forEach(([n, p]) => stmt.run(n, p));
      stmt.finalize();
      console.log("Servicios por defecto insertados");
    }
  });
});

// Tabla horarios (barber schedules)
db.run(`
  CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barbero_id INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    FOREIGN KEY (barbero_id) REFERENCES usuarios(id)
  )
`);

// Tabla reseñas (client reviews)
db.run(`
  CREATE TABLE IF NOT EXISTS resenas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cita_id INTEGER NOT NULL UNIQUE,
    cliente_id INTEGER NOT NULL,
    barbero_id INTEGER,
    puntuacion INTEGER NOT NULL CHECK(puntuacion >= 1 AND puntuacion <= 5),
    comentario TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cita_id) REFERENCES citas(id),
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    FOREIGN KEY (barbero_id) REFERENCES usuarios(id)
  )
`);


// ================================
// MIDDLEWARE: AUTH (JWT)
// ================================
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Token requerido" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, rol, email, nombre }
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

// ================================
// MIDDLEWARE: AUTHORIZE ROLES
// ================================
function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: "No autorizado para este recurso" });
    }
    next();
  };
}

/* =========================================
   RUTAS BASICAS
========================================= */

app.get("/", (_, res) => {
  res.send("API Barberia funcionando");
});

app.get("/test-db", (_, res) => {
  db.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* =========================================
   BARBEROS (público - para dropdown de reservas)
========================================= */

app.get("/api/barberos", (_, res) => {
  db.all(
    `SELECT id, nombre FROM usuarios WHERE rol = 'barbero' ORDER BY nombre`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

/* =========================================
   SERVICIOS (CRUD)
========================================= */

// Listar servicios (publico)
app.get("/api/servicios", (_, res) => {
  db.all(`SELECT * FROM servicios ORDER BY id`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Crear servicio (admin)
app.post("/api/servicios", auth, authorize("admin"), (req, res) => {
  const { nombre, precio } = req.body;

  if (!nombre || precio == null) {
    return res.status(400).json({ error: "Nombre y precio son obligatorios" });
  }

  if (Number(precio) <= 0) {
    return res.status(400).json({ error: "El precio debe ser mayor a 0" });
  }

  db.run(
    `INSERT INTO servicios (nombre, precio) VALUES (?, ?)`,
    [nombre, Number(precio)],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ mensaje: "Servicio creado", id: this.lastID, nombre, precio: Number(precio) });
    }
  );
});

// Actualizar servicio (admin)
app.put("/api/servicios/:id", auth, authorize("admin"), (req, res) => {
  const { id } = req.params;
  const { nombre, precio } = req.body;

  if (!nombre || precio == null) {
    return res.status(400).json({ error: "Nombre y precio son obligatorios" });
  }

  db.run(
    `UPDATE servicios SET nombre = ?, precio = ? WHERE id = ?`,
    [nombre, precio, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Servicio no encontrado" });
      res.json({ mensaje: "Servicio actualizado", id, nombre, precio });
    }
  );
});

// Eliminar servicio (admin)
app.delete("/api/servicios/:id", auth, authorize("admin"), (req, res) => {
  const { id } = req.params;

  // Check if service is used in active appointments
  db.get(
    `SELECT COUNT(*) AS total FROM citas WHERE servicio = (SELECT nombre FROM servicios WHERE id = ?) AND estado NOT IN ('cancelada')`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      if (row && row.total > 0) {
        return res.status(409).json({
          error: `No se puede eliminar: el servicio tiene ${row.total} cita(s) activa(s)`,
        });
      }

      db.run(`DELETE FROM servicios WHERE id = ?`, [id], function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        if (this.changes === 0) return res.status(404).json({ error: "Servicio no encontrado" });
        res.json({ mensaje: "Servicio eliminado" });
      });
    }
  );
});

/* =========================================
   EMPLEADOS (solo admin)
========================================= */

app.get("/api/empleados", auth, authorize("admin", "barbero", "recepcionista"), (req, res) => {
  db.all(
    `SELECT id, nombre, email, rol, created_at
     FROM usuarios
     WHERE rol IN ('barbero', 'recepcionista')
     ORDER BY nombre`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Crear empleado (admin)
app.post("/api/empleados", auth, authorize("admin"), (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  if (!['barbero', 'recepcionista'].includes(rol)) {
    return res.status(400).json({ error: "El rol debe ser 'barbero' o 'recepcionista'" });
  }

  const emailNorm = String(email).trim().toLowerCase();

  db.run(
    `INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)`,
    [nombre, emailNorm, password, rol],
    function (err) {
      if (err) {
        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(409).json({ error: "El email ya está registrado" });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ mensaje: "Empleado creado", id: this.lastID, nombre, email: emailNorm, rol });
    }
  );
});

// Eliminar empleado (admin)
app.delete("/api/empleados/:id", auth, authorize("admin"), (req, res) => {
  const { id } = req.params;

  // Verify it's an employee (barbero or recepcionista)
  db.get(`SELECT id, rol FROM usuarios WHERE id = ?`, [id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "Empleado no encontrado" });
    if (!['barbero', 'recepcionista'].includes(user.rol)) {
      return res.status(403).json({ error: "Solo se pueden eliminar barberos o recepcionistas" });
    }

    // Check for active appointments
    db.get(
      `SELECT COUNT(*) AS total FROM citas WHERE barbero_id = ? AND estado NOT IN ('cancelada')`,
      [id],
      (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });

        if (row && row.total > 0) {
          return res.status(409).json({
            error: `No se puede eliminar: tiene ${row.total} cita(s) activa(s) asignada(s)`,
          });
        }

        db.run(`DELETE FROM usuarios WHERE id = ?`, [id], function (err3) {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ mensaje: "Empleado eliminado" });
        });
      }
    );
  });
});
/* =========================================
   BARBERO DASHBOARD
========================================= */

// Citas para el barbero (semana completa)
app.get("/api/barbero/citas", auth, authorize("barbero"), (req, res) => {
  // Optional ?semana=YYYY-MM-DD to pick a specific week (Monday)
  const semanaParam = req.query.semana; // e.g. "2026-03-09"

  let inicioSemana, finSemana;

  if (semanaParam) {
    const d = new Date(semanaParam + "T00:00:00");
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    inicioSemana = new Date(d);
    inicioSemana.setDate(d.getDate() + diffToMon);
  } else {
    const hoy = new Date();
    const day = hoy.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() + diffToMon);
  }

  finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 6);

  const desde = inicioSemana.toISOString().split("T")[0];
  const hasta = finSemana.toISOString().split("T")[0];

  db.all(
    `SELECT * FROM citas
     WHERE fecha BETWEEN ? AND ? AND barbero_id = ?
     ORDER BY fecha, hora`,
    [desde, hasta, req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ desde, hasta, citas: rows });
    }
  );
});

// Stats del dia para el barbero
app.get("/api/barbero/stats", auth, authorize("barbero"), (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];

  // Get Monday of current week
  const ahora = new Date();
  const day = ahora.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const lunes = new Date(ahora);
  lunes.setDate(ahora.getDate() + diffToMon);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const desdeSemana = lunes.toISOString().split("T")[0];
  const hastaSemana = domingo.toISOString().split("T")[0];

  db.all(
    `SELECT estado, fecha FROM citas WHERE fecha BETWEEN ? AND ? AND barbero_id = ?`,
    [desdeSemana, hastaSemana, req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const citasHoy = rows.filter((r) => r.fecha === hoy);
      const pendientesHoy = citasHoy.filter((r) => r.estado === "pendiente").length;
      const cumplidasHoy = citasHoy.filter((r) => r.estado === "cumplida").length;
      const totalSemana = rows.filter((r) => r.estado !== "cancelada").length;

      res.json({
        hoy: citasHoy.length,
        pendientes: pendientesHoy,
        cumplidas: cumplidasHoy,
        total_semana: totalSemana,
      });
    }
  );
});

// Notificaciones (citas creadas en los últimos N minutos)
app.get("/api/barbero/notificaciones", auth, authorize("barbero"), (req, res) => {
  const minutos = parseInt(req.query.minutos) || 5;

  db.all(
    `SELECT id, cliente, servicio, fecha, hora, created_at
     FROM citas
     WHERE created_at >= datetime('now', ?)
     ORDER BY created_at DESC`,
    [`-${minutos} minutes`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

/* =========================================
   CU1: REGISTRO DE USUARIOS
========================================= */

app.post("/api/usuarios/registro", (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({
      error: "Faltan campos obligatorios",
    });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const rolFinal = rol || "cliente";

  db.run(
    `INSERT INTO usuarios (nombre, email, password, rol)
     VALUES (?, ?, ?, ?)`,
    [nombre, emailNorm, password, rolFinal],
    function (err) {
      if (err) {
        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(409).json({ error: "Email ya registrado" });
        }
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        mensaje: "Usuario registrado",
        id: this.lastID,
      });
    }
  );
});

/* =========================================
   CU2: LOGIN DE USUARIOS
========================================= */

app.post("/api/usuarios/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email y password obligatorios" });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const passNorm = String(password).trim();

  db.get(
    `SELECT id, nombre, email, rol, password
     FROM usuarios WHERE email = ?`,
    [emailNorm],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!user || user.password !== passNorm) {
        return res.status(401).json({ error: "Credenciales invalidas" });
      }

      // Crear token JWT con id y rol
      const token = jwt.sign(
        {
          id: user.id,
          rol: user.rol,
          email: user.email,
          nombre: user.nombre,
        },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      // incluir token
      return res.json({
        mensaje: "Login correcto",
        token,
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol,
        },
      });
    }
  );
});

/* =========================================
   CRUD CITAS
========================================= */

// Obtener todas
app.get("/api/citas", (_, res) => {
  db.all(`SELECT * FROM citas ORDER BY fecha, hora`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Crear cita
app.post("/api/citas", (req, res) => {
  const { cliente, servicio, fecha, hora } = req.body;

  if (!cliente || !servicio || !fecha || !hora) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  db.run(
    `INSERT INTO citas (cliente, servicio, fecha, hora)
     VALUES (?, ?, ?, ?)`,
    [cliente, servicio, fecha, hora],
    function (err) {
      if (err) {
        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(409).json({
            error: "Ya existe una cita en esa fecha y hora",
          });
        }
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        id: this.lastID,
        cliente,
        servicio,
        fecha,
        hora,
      });
    }
  );
});

// Editar cita (admin)
app.put("/api/citas/:id", auth, authorize("admin"), (req, res) => {
  const { id } = req.params;
  const { cliente, servicio, fecha, hora } = req.body;

  if (!cliente || !servicio || !fecha || !hora) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  db.run(
    `UPDATE citas SET cliente = ?, servicio = ?, fecha = ?, hora = ? WHERE id = ?`,
    [cliente, servicio, fecha, hora, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Cita no encontrada" });
      res.json({ mensaje: "Cita actualizada" });
    }
  );
});

// Eliminar
app.delete("/api/citas/:id", (req, res) => {
  db.run(`DELETE FROM citas WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    if (this.changes === 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    res.json({ mensaje: "Cita eliminada" });
  });
});

/* =========================================
   CANCELAR CITA (CU7)
========================================= */

app.patch("/api/citas/:id/cancelar", (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM citas WHERE id = ?`, [id], (err, cita) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });

    const hoy = new Date();
    const fechaCita = new Date(`${cita.fecha}T${cita.hora}`);

    const diffDias = Math.ceil(
      (fechaCita - hoy) / (1000 * 60 * 60 * 24)
    );

    const multa = diffDias < 2 ? 1 : 0;

    db.run(
      `UPDATE citas SET estado = 'cancelada', multa = ?
       WHERE id = ?`,
      [multa, id],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });

        res.json({
          mensaje: multa
            ? "Cancelada con multa"
            : "Cancelada sin multa",
          multa,
        });
      }
    );
  });
});

/* =========================================
   MARCAR CUMPLIDA (CU6)
========================================= */

app.patch("/api/citas/:id/cumplida", auth, authorize("admin", "barbero", "recepcionista"), (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE citas SET estado = 'cumplida'
     WHERE id = ? AND estado != 'cancelada'`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (this.changes === 0) {
        return res.status(400).json({
          error: "No se puede marcar como cumplida",
        });
      }

      res.json({ mensaje: "Cita marcada como cumplida" });
    }
  );
});

app.get("/api/cliente/citas", auth, authorize("cliente"), (req, res) => {
  db.all(
    `SELECT c.*, u.nombre AS barbero_nombre
     FROM citas c
     LEFT JOIN usuarios u ON c.barbero_id = u.id
     WHERE c.cliente_id = ?
     ORDER BY c.fecha, c.hora`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Crear cita como cliente autenticado (supports multiple services)
app.post("/api/cliente/citas", auth, authorize("cliente"), (req, res) => {
  let { servicio, servicios, fecha, hora, barbero_id } = req.body;

  // Support both single 'servicio' and array 'servicios'
  if (servicios && Array.isArray(servicios) && servicios.length > 0) {
    servicio = servicios.join(", ");
  }

  if (!servicio || !fecha || !hora) {
    return res.status(400).json({ error: "Datos incompletos (servicio, fecha, hora)" });
  }

  const cliente = req.user.nombre;
  const cliente_id = req.user.id;

  db.run(
    `INSERT INTO citas (cliente, servicio, fecha, hora, cliente_id, barbero_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [cliente, servicio, fecha, hora, cliente_id, barbero_id || null],
    function (err) {
      if (err) {
        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(409).json({
            error: "Ya existe una cita en esa fecha y hora",
          });
        }
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        id: this.lastID,
        cliente,
        servicio,
        fecha,
        hora,
        cliente_id,
        barbero_id: barbero_id || null,
        estado: "pendiente",
      });
    }
  );
});


/* =========================================
   PASSWORD RESET
========================================= */

// Admin resets any user's password
app.patch("/api/admin/reset-password/:id", auth, authorize("admin"), (req, res) => {
  const { id } = req.params;
  const { nuevaPassword } = req.body;

  if (!nuevaPassword || nuevaPassword.length < 4) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 4 caracteres" });
  }

  db.run(
    `UPDATE usuarios SET password = ? WHERE id = ?`,
    [nuevaPassword, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json({ mensaje: "Contraseña restablecida exitosamente" });
    }
  );
});

// Self-service password reset (client enters email + name for verification)
app.post("/api/reset-password", (req, res) => {
  const { email, nombre, nuevaPassword } = req.body;

  if (!email || !nombre || !nuevaPassword) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  if (nuevaPassword.length < 4) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 4 caracteres" });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const nombreNorm = String(nombre).trim().toLowerCase();

  db.get(
    `SELECT id, nombre FROM usuarios WHERE LOWER(email) = ?`,
    [emailNorm],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: "No se encontró una cuenta con ese correo" });

      // Verify name matches (simple identity check)
      if (user.nombre.trim().toLowerCase() !== nombreNorm) {
        return res.status(403).json({ error: "El nombre no coincide con la cuenta" });
      }

      db.run(
        `UPDATE usuarios SET password = ? WHERE id = ?`,
        [nuevaPassword, user.id],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ mensaje: "Contraseña actualizada exitosamente" });
        }
      );
    }
  );
});

/* =========================================
   STRIPE PAYMENTS
========================================= */

// Create Stripe Checkout Session
app.post("/api/create-checkout-session", auth, authorize("cliente"), (req, res) => {
  const { cita_id } = req.body;

  if (!cita_id) {
    return res.status(400).json({ error: "cita_id es obligatorio" });
  }

  // Look up the appointment
  db.get(`SELECT * FROM citas WHERE id = ? AND cliente_id = ?`, [cita_id, req.user.id], (err, cita) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!cita) return res.status(404).json({ error: "Cita no encontrada" });

    if (cita.payment_status === "paid") {
      return res.status(400).json({ error: "Esta cita ya fue pagada" });
    }

    // Look up service price(s) — handles comma-separated multi-service
    const serviceNames = cita.servicio.split(",").map(s => s.trim()).filter(Boolean);

    db.all(
      `SELECT * FROM servicios WHERE nombre IN (${serviceNames.map(() => "?").join(",")})`,
      serviceNames,
      async (err2, serviciosFound) => {
        if (err2) return res.status(500).json({ error: err2.message });
        if (!serviciosFound || serviciosFound.length === 0) {
          return res.status(404).json({ error: "Servicio no encontrado" });
        }

        const totalPrice = serviciosFound.reduce((sum, s) => sum + s.precio, 0);
        const serviceLabel = serviciosFound.map(s => s.nombre).join(", ");

        try {
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: serviciosFound.map(s => ({
              price_data: {
                currency: "cop",
                product_data: {
                  name: s.nombre,
                  description: `Fecha: ${cita.fecha} | Hora: ${cita.hora}`,
                },
                unit_amount: s.precio * 100,
              },
              quantity: 1,
            })),
            mode: "payment",
            success_url: `http://localhost:5174/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:5174/payment-cancel`,
            metadata: {
              cita_id: String(cita.id),
              cliente_id: String(req.user.id),
            },
          });

          db.run(
            `UPDATE citas SET stripe_session_id = ? WHERE id = ?`,
            [session.id, cita.id]
          );

          res.json({ url: session.url });
        } catch (stripeErr) {
          console.error("Stripe error:", stripeErr.message);
          res.status(500).json({ error: "Error creando sesión de pago: " + stripeErr.message });
      }
    });
  });
});

// Verify payment after Stripe redirect
app.get("/api/verify-payment", auth, (req, res) => {
  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: "session_id es obligatorio" });
  }

  (async () => {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status === "paid") {
        const citaId = session.metadata.cita_id;

        db.run(
          `UPDATE citas SET payment_status = 'paid' WHERE id = ?`,
          [citaId],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: "Pago verificado exitosamente", payment_status: "paid" });
          }
        );
      } else {
        res.json({ mensaje: "Pago aún no completado", payment_status: session.payment_status });
      }
    } catch (stripeErr) {
      console.error("Stripe verify error:", stripeErr.message);
      res.status(500).json({ error: "Error verificando pago: " + stripeErr.message });
    }
  })();
});

/* =========================================
   HORARIOS CRUD (Barber Schedules)
========================================= */

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Get schedule for a barber (public)
app.get("/api/horarios/:barberoId", (req, res) => {
  const { barberoId } = req.params;
  db.all(
    `SELECT * FROM horarios WHERE barbero_id = ? ORDER BY dia_semana, hora_inicio`,
    [barberoId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Get all schedules (admin)
app.get("/api/horarios", auth, authorize("admin"), (req, res) => {
  db.all(
    `SELECT h.*, u.nombre AS barbero_nombre
     FROM horarios h
     JOIN usuarios u ON h.barbero_id = u.id
     ORDER BY u.nombre, h.dia_semana, h.hora_inicio`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Create schedule entry (admin)
app.post("/api/horarios", auth, authorize("admin"), (req, res) => {
  const { barbero_id, dia_semana, hora_inicio, hora_fin } = req.body;

  if (barbero_id == null || dia_semana == null || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }
  if (dia_semana < 0 || dia_semana > 6) {
    return res.status(400).json({ error: "dia_semana debe ser 0-6 (Dom-Sáb)" });
  }
  if (hora_inicio >= hora_fin) {
    return res.status(400).json({ error: "hora_inicio debe ser antes de hora_fin" });
  }

  db.run(
    `INSERT INTO horarios (barbero_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)`,
    [barbero_id, dia_semana, hora_inicio, hora_fin],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ mensaje: "Horario creado", id: this.lastID });
    }
  );
});

// Update schedule entry (admin)
app.put("/api/horarios/:id", auth, authorize("admin"), (req, res) => {
  const { id } = req.params;
  const { dia_semana, hora_inicio, hora_fin } = req.body;

  if (dia_semana == null || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }
  if (hora_inicio >= hora_fin) {
    return res.status(400).json({ error: "hora_inicio debe ser antes de hora_fin" });
  }

  db.run(
    `UPDATE horarios SET dia_semana = ?, hora_inicio = ?, hora_fin = ? WHERE id = ?`,
    [dia_semana, hora_inicio, hora_fin, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Horario no encontrado" });
      res.json({ mensaje: "Horario actualizado" });
    }
  );
});

// Delete schedule entry (admin)
app.delete("/api/horarios/:id", auth, authorize("admin"), (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM horarios WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Horario no encontrado" });
    res.json({ mensaje: "Horario eliminado" });
  });
});

// Available time slots (public): given barbero_id + fecha, returns free slots
app.get("/api/horarios-disponibles", (req, res) => {
  const { barbero_id, fecha } = req.query;
  if (!barbero_id || !fecha) {
    return res.status(400).json({ error: "barbero_id y fecha son obligatorios" });
  }

  // Get day of week for the given date (0=Sun, 6=Sat)
  const d = new Date(fecha + "T12:00:00");
  const diaSemana = d.getDay();

  // Get barber's schedule for that day
  db.all(
    `SELECT hora_inicio, hora_fin FROM horarios WHERE barbero_id = ? AND dia_semana = ?`,
    [barbero_id, diaSemana],
    (err, horarios) => {
      if (err) return res.status(500).json({ error: err.message });

      // If no schedule exists, return default hours 8-20 (fallback)
      if (horarios.length === 0) {
        const defaultSlots = [];
        for (let h = 8; h <= 20; h++) {
          defaultSlots.push(`${String(h).padStart(2, "0")}:00`);
        }

        // Still filter out booked slots
        db.all(
          `SELECT hora FROM citas WHERE fecha = ? AND barbero_id = ? AND estado != 'cancelada'`,
          [fecha, barbero_id],
          (err2, booked) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const bookedHours = new Set(booked.map((b) => b.hora.split(":")[0]));
            const available = defaultSlots.filter((s) => !bookedHours.has(s.split(":")[0]));
            res.json({ slots: available, sinHorario: true });
          }
        );
        return;
      }

      // Generate 1-hour slots from schedule
      const allSlots = [];
      horarios.forEach((h) => {
        let startHour = parseInt(h.hora_inicio.split(":")[0]);
        const endHour = parseInt(h.hora_fin.split(":")[0]);
        while (startHour < endHour) {
          allSlots.push(`${String(startHour).padStart(2, "0")}:00`);
          startHour++;
        }
      });

      // Remove already booked slots
      db.all(
        `SELECT hora FROM citas WHERE fecha = ? AND barbero_id = ? AND estado != 'cancelada'`,
        [fecha, barbero_id],
        (err2, booked) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const bookedHours = new Set(booked.map((b) => b.hora.split(":")[0]));
          const available = allSlots.filter((s) => !bookedHours.has(s.split(":")[0]));

          res.json({ slots: available });
        }
      );
    }
  );
});

/* =========================================
   BARBER SELF-SERVICE SCHEDULE
========================================= */

// Get own schedule
app.get("/api/barbero/horarios", auth, authorize("barbero"), (req, res) => {
  db.all(
    `SELECT * FROM horarios WHERE barbero_id = ? ORDER BY dia_semana, hora_inicio`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Create own schedule entry
app.post("/api/barbero/horarios", auth, authorize("barbero"), (req, res) => {
  const { dia_semana, hora_inicio, hora_fin } = req.body;

  if (dia_semana == null || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }
  if (dia_semana < 0 || dia_semana > 6) {
    return res.status(400).json({ error: "dia_semana debe ser 0-6" });
  }
  if (hora_inicio >= hora_fin) {
    return res.status(400).json({ error: "hora_inicio debe ser antes de hora_fin" });
  }

  db.run(
    `INSERT INTO horarios (barbero_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)`,
    [req.user.id, dia_semana, hora_inicio, hora_fin],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ mensaje: "Horario creado", id: this.lastID });
    }
  );
});

// Delete own schedule entry
app.delete("/api/barbero/horarios/:id", auth, authorize("barbero"), (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM horarios WHERE id = ? AND barbero_id = ?`, [id, req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Horario no encontrado" });

    db.run(`DELETE FROM horarios WHERE id = ?`, [id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ mensaje: "Horario eliminado" });
    });
  });
});

/* =========================================
   RESEÑAS CRUD (Client Reviews)
========================================= */

// Create review (client, only for their own cumplida citas)
app.post("/api/resenas", auth, authorize("cliente"), (req, res) => {
  const { cita_id, puntuacion, comentario } = req.body;

  if (!cita_id || !puntuacion) {
    return res.status(400).json({ error: "cita_id y puntuacion son obligatorios" });
  }
  if (puntuacion < 1 || puntuacion > 5) {
    return res.status(400).json({ error: "Puntuación debe ser entre 1 y 5" });
  }

  // Verify the cita belongs to the client and is cumplida
  db.get(
    `SELECT * FROM citas WHERE id = ? AND cliente_id = ?`,
    [cita_id, req.user.id],
    (err, cita) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!cita) return res.status(404).json({ error: "Cita no encontrada" });
      if (cita.estado !== "cumplida") {
        return res.status(400).json({ error: "Solo puedes calificar citas cumplidas" });
      }

      db.run(
        `INSERT INTO resenas (cita_id, cliente_id, barbero_id, puntuacion, comentario)
         VALUES (?, ?, ?, ?, ?)`,
        [cita_id, req.user.id, cita.barbero_id, puntuacion, comentario || ""],
        function (err2) {
          if (err2) {
            if (err2.code === "SQLITE_CONSTRAINT") {
              return res.status(409).json({ error: "Ya calificaste esta cita" });
            }
            return res.status(500).json({ error: err2.message });
          }
          res.status(201).json({ mensaje: "Reseña creada", id: this.lastID });
        }
      );
    }
  );
});

// Get reviews for a barber (public)
app.get("/api/resenas/barbero/:barberoId", (req, res) => {
  const { barberoId } = req.params;
  db.all(
    `SELECT r.*, u.nombre AS cliente_nombre
     FROM resenas r
     JOIN usuarios u ON r.cliente_id = u.id
     WHERE r.barbero_id = ?
     ORDER BY r.created_at DESC`,
    [barberoId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Calculate average
      const avg = rows.length > 0
        ? (rows.reduce((sum, r) => sum + r.puntuacion, 0) / rows.length).toFixed(1)
        : 0;

      res.json({ promedio: parseFloat(avg), total: rows.length, resenas: rows });
    }
  );
});

// Get reviews for the authenticated client's citas
app.get("/api/resenas/mis", auth, authorize("cliente"), (req, res) => {
  db.all(
    `SELECT * FROM resenas WHERE cliente_id = ?`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Delete review (client owns it or admin)
app.delete("/api/resenas/:id", auth, (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM resenas WHERE id = ?`, [id], (err, resena) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!resena) return res.status(404).json({ error: "Reseña no encontrada" });

    if (req.user.rol !== "admin" && resena.cliente_id !== req.user.id) {
      return res.status(403).json({ error: "No autorizado" });
    }

    db.run(`DELETE FROM resenas WHERE id = ?`, [id], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ mensaje: "Reseña eliminada" });
    });
  });
});

/* =========================================
   ADMIN STATS
========================================= */

app.get("/api/admin/stats", auth, authorize("admin"), (req, res) => {
  const hoy = new Date();
  const day = hoy.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffToMon);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const desdeSemana = lunes.toISOString().split("T")[0];
  const hastaSemana = domingo.toISOString().split("T")[0];

  const stats = {};

  // Total clients
  db.get(`SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'cliente'`, (err, r) => {
    if (err) return res.status(500).json({ error: err.message });
    stats.total_clientes = r.total;

    // Total appointments
    db.get(`SELECT COUNT(*) AS total FROM citas`, (err2, r2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      stats.total_citas = r2.total;

      // Completed this week
      db.get(
        `SELECT COUNT(*) AS total FROM citas WHERE estado = 'cumplida' AND fecha BETWEEN ? AND ?`,
        [desdeSemana, hastaSemana],
        (err3, r3) => {
          if (err3) return res.status(500).json({ error: err3.message });
          stats.cumplidas_semana = r3.total;

          // Revenue this week (join with servicios to get price)
          db.get(
            `SELECT COALESCE(SUM(s.precio), 0) AS total
             FROM citas c
             JOIN servicios s ON c.servicio = s.nombre
             WHERE c.estado = 'cumplida' AND c.fecha BETWEEN ? AND ?`,
            [desdeSemana, hastaSemana],
            (err4, r4) => {
              if (err4) return res.status(500).json({ error: err4.message });
              stats.ingresos_semana = r4.total;

              // Most popular service
              db.get(
                `SELECT servicio, COUNT(*) AS total FROM citas
                 WHERE estado != 'cancelada'
                 GROUP BY servicio ORDER BY total DESC LIMIT 1`,
                (err5, r5) => {
                  if (err5) return res.status(500).json({ error: err5.message });
                  stats.servicio_popular = r5 ? r5.servicio : "N/A";

                  // Top barber (most cumplidas)
                  db.get(
                    `SELECT u.nombre, COUNT(*) AS total
                     FROM citas c
                     JOIN usuarios u ON c.barbero_id = u.id
                     WHERE c.estado = 'cumplida'
                     GROUP BY c.barbero_id ORDER BY total DESC LIMIT 1`,
                    (err6, r6) => {
                      if (err6) return res.status(500).json({ error: err6.message });
                      stats.top_barbero = r6 ? r6.nombre : "N/A";

                      res.json(stats);
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
});

/* =========================================
   USER PROFILE
========================================= */

// Get own profile
app.get("/api/perfil", auth, (req, res) => {
  db.get(
    `SELECT id, nombre, email, rol, created_at FROM usuarios WHERE id = ?`,
    [req.user.id],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
      res.json(user);
    }
  );
});

// Update own profile
app.put("/api/perfil", auth, (req, res) => {
  const { nombre, email, passwordActual, nuevaPassword } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ error: "Nombre y email son obligatorios" });
  }

  // Verify current user
  db.get(`SELECT * FROM usuarios WHERE id = ?`, [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // If changing password, verify current
    if (nuevaPassword) {
      if (!passwordActual) {
        return res.status(400).json({ error: "Ingresa tu contraseña actual para cambiarla" });
      }
      if (user.password !== passwordActual.trim()) {
        return res.status(403).json({ error: "Contraseña actual incorrecta" });
      }
      if (nuevaPassword.length < 4) {
        return res.status(400).json({ error: "La nueva contraseña debe tener al menos 4 caracteres" });
      }
    }

    const emailNorm = String(email).trim().toLowerCase();
    const newPass = nuevaPassword ? nuevaPassword : user.password;

    db.run(
      `UPDATE usuarios SET nombre = ?, email = ?, password = ? WHERE id = ?`,
      [nombre, emailNorm, newPass, req.user.id],
      function (err2) {
        if (err2) {
          if (err2.code === "SQLITE_CONSTRAINT") {
            return res.status(409).json({ error: "El email ya está en uso" });
          }
          return res.status(500).json({ error: err2.message });
        }
        res.json({ mensaje: "Perfil actualizado", nombre, email: emailNorm });
      }
    );
  });
});

/* =========================================
   INICIAR SERVIDOR
========================================= */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Prueba DB en http://localhost:${PORT}/test-db`);
});