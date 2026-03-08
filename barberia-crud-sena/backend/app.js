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

// Crear cita como cliente autenticado
app.post("/api/cliente/citas", auth, authorize("cliente"), (req, res) => {
  const { servicio, fecha, hora, barbero_id } = req.body;

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

    // Look up service price
    db.get(`SELECT * FROM servicios WHERE nombre = ?`, [cita.servicio], async (err2, servicio) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (!servicio) return res.status(404).json({ error: "Servicio no encontrado" });

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "cop",
                product_data: {
                  name: `Cita: ${servicio.nombre}`,
                  description: `Fecha: ${cita.fecha} | Hora: ${cita.hora} | Cliente: ${cita.cliente}`,
                },
                unit_amount: servicio.precio * 100, // COP uses centavos: multiply by 100
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `http://localhost:5173/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `http://localhost:5173/payment-cancel`,
          metadata: {
            cita_id: String(cita.id),
            cliente_id: String(req.user.id),
          },
        });

        // Save session ID on the appointment
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
   INICIAR SERVIDOR
========================================= */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Prueba DB en http://localhost:${PORT}/test-db`);
});