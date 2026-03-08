# Sistema de Gestión de Citas para Barbería

Aplicación web desarrollada con arquitectura cliente-servidor para la gestión de citas en una barbería.

Permite crear, consultar, actualizar y eliminar citas (CRUD completo) utilizando tecnologías modernas de desarrollo web.

---

## Objetivo

Implementar los módulos funcionales del software aplicando frameworks web modernos, cumpliendo con los requisitos de la evidencia de desempeño del SENA.

---

## Tecnologías utilizadas

### Frontend
- React (Vite)
- JavaScript
- HTML5
- CSS

### Backend
- Node.js
- Express
- SQLite
- CORS

---

## Funcionalidades

- Crear citas  
- Listar citas  
- Consultar citas por ID  
- Actualizar citas  
- Eliminar citas  
- Persistencia de datos en SQLite  
- Interfaz web interactiva  

---

## Arquitectura del sistema

Cliente (React) ⇄ API REST (Node + Express) ⇄ Base de datos (SQLite)

---

## Estructura del proyecto

## Cómo ejecutar el proyecto

### 1. Clonar o descargar el repositorio

### 2️. Ejecutar el backend

Abrir terminal en la carpeta backend:

cd backend
node app.js


El servidor se ejecutará en:

http://localhost:3000

### 3️. Ejecutar el frontend

Abrir otra terminal en la carpeta frontend:
cd frontend
npm install
npm run dev


La aplicación estará disponible en:

http://localhost:5173

---

## Base de datos

Se utiliza SQLite como sistema de persistencia local.

La base de datos se crea automáticamente al ejecutar el backend.

---

## Documentación APIS:

Documentación de APIs proyecto Barbería CRUD SENA
URL base:  http://localhost:3000 endpoints totales: 20

Clasificación de las APIs:
Se tienen 2 categorías:
CRUD: Estándar, create, read, update, delete operaciones en el recurso de mi base de datos
Acción: Hacen una operación específica de negocio, transición de estado, o llaman a un servicio externo. 

Tabla resumen
#
Método
Endpoint
Tipo
Autenticación
Descripción
1
GET
/
Utilidad
No
Chequeo
2
GET
/test-db
Utilidad
No
Lista de tablas de la base de datos
3
GET
/api/barberos
CRUD (Read)
No
Lista barberos
4
GET
/api/servicios
CRUD (Read)
No
Lista servicios
5
PUT
/api/servicios/:id
CRUD (Update)
Admin
Actualizar servicio
6
GET
/api/empleados
CRUD (Read)
Admin/ Barb/ recepcionista
Lista de empleados
7
GET
/api/barbero/citas
CRUD (Read)
Barbero
Citas semanales de los barberos
8
GET
/api/barbero/stats
Acción
Barbero
Estadísticas barberos, semanales/diarias
9
GET
/api/barbero/notificaciones
Acción
Barbero
Alertas de citas recientes
10
POST
/api/usuarios/registro
CRUD (Create)
No
Registrar usuario
11
POST
/api/usuarios/login
Acción
No
Login retorna el Jason Web Token
12
GET
/api/citas
CRUD (Read)
No
Lista de todas las citas
13
POST
/api/citas
CRUD (Create)
No
Crear una cita genérica
14
PUT
/api/citas/:id
CRUD (Update)
Admin
Editar cita
15
DELETE
/api/citas/:id
CRUD (Delete)
No
Borrar cita
16
PATCH
/api/citas/:id/cancelar
Acción
No
Cancelar cita con multa
17
PATCH
/api/citas/:id/cumplida
Acción
Admin/ Barb/ recepcionista
Marcar cita cumplida
18
GET
/api/cliente/citas
CRUD (Read)
Cliente
Citas propias de los clientes
19
POST
/api/cliente/citas
CRUD (Create)
Cliente
Citas creadas cliente
20
PATCH
/api/admin/reset-password/:id
Acción
Admin
Admin reinicia contraseña
21
POST
/api/reset-password
Acción
No
Reinicio de contraseña de cliente
22
POST
/api/create-checkout-session
Acción
Cliente
Crear la sesión de pago Stripe
23
GET
/api/verify-payment
Acción
Cualquiera
Verificar el pago Stripe



APIs totales:     23  
CRUD APIs:      12 
APIs de acción:     9  
APIs de utilidad:    2 

---

## Requisitos previos

- Node.js instalado
- NPM instalado
- Navegador web moderno

---

## Autor

**Miguel Hernandez Abril**

Tecnólogo en Análisis y Desarrollo de Software — SENA

---

## Evidencia académica

Proyecto desarrollado como parte de la evidencia:

**Codificación de módulos del software Stand alone, web y móvil**

Servicio Nacional de Aprendizaje — SENA
