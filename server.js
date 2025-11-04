// --- Importaciones ---
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Conexión a MongoDB Atlas ---
const MONGO_URI = 'mongodb+srv://zama1235_db_user:FyZTjThcMNbn9lzX@aplicaciondwm.pgyb5x7.mongodb.net/jugueteria?retryWrites=true&w=majority&appName=AplicacionDWM';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log(' Conectado a MongoDB Atlas'))
.catch(err => console.error(' Error al conectar a MongoDB:', err));

// --- Configuración de sesión ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'clave-ultra-secreta',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    ttl: 60 * 60 * 24
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: false
  }
}));

// --- Modelos ---
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'user' }
});

const productoSchema = new mongoose.Schema({
  idProducto: { type: Number, unique: true },
  nombre: String,
  precio: Number,
  categoria: String,
  descripcion: String,
  imagen: String
});

const User = mongoose.model('User', userSchema);
const Producto = mongoose.model('Producto', productoSchema);

// --- Middleware de sesión ---
function verificarSesion(req, res, next) {
  if (req.session.user) return next();
  res.status(401).json({ error: 'No autenticado' });
}

function verificarAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).json({ error: 'Acceso denegado' });
}

// --- Registro ---
app.post('/register-process', async (req, res) => {
  const { username, email, password, confirm_password } = req.body;
  if (!username || !email || !password || !confirm_password)
    return res.status(400).send('Faltan campos obligatorios');
  if (password !== confirm_password)
    return res.status(400).send('Las contraseñas no coinciden');

  try {
    const existente = await User.findOne({ email });
    if (existente) return res.status(400).send('Correo ya registrado');

    const hashed = await bcrypt.hash(password, 10);
    const nuevo = new User({ username, email, password: hashed });
    await nuevo.save();

    res.redirect('/index.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al registrar usuario');
  }
});

// --- Login ---
app.post('/login-process', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).send('Usuario o contraseña incorrectos');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).send('Usuario o contraseña incorrectos');

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    res.redirect('/catalogo.html');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al iniciar sesión');
  }
});

// --- Usuario logueado ---
app.get('/usuario', (req, res) => {
  if (req.session.user) return res.json(req.session.user);
  res.status(401).json({ message: 'No autenticado' });
});

// --- Logout ---
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('Error al cerrar sesión');
    res.clearCookie('connect.sid');
    res.redirect('/index.html');
  });
});

// --- ADMIN: agregar producto ---
app.post('/api/admin/agregar-producto', verificarAdmin, async (req, res) => {
  try {
    const { idProducto, nombre, precio, categoria, descripcion, imagen } = req.body;
    if (!idProducto || !nombre || !precio || !categoria)
      return res.status(400).json({ error: 'Faltan campos obligatorios' });

    const existente = await Producto.findOne({ idProducto });
    if (existente) return res.status(400).json({ error: 'El ID ya existe' });

    const nuevo = new Producto({ idProducto, nombre, precio, categoria, descripcion, imagen });
    await nuevo.save();
    res.json({ mensaje: 'Producto agregado correctamente', producto: nuevo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- Catálogo ---
app.get('/api/productos', async (req, res) => {
  const productos = await Producto.find();
  res.json(productos);
});

// --- API del carrito ---
function inicializarCarrito(req) {
  if (!req.session.carrito) req.session.carrito = [];
  return req.session.carrito;
}

// ✅ Requiere sesión
app.get('/api/carrito', verificarSesion, (req, res) => {
  const carrito = inicializarCarrito(req);
  res.json(carrito);
});

app.post('/api/carrito/agregar', verificarSesion, async (req, res) => {
  try {
    const { idProducto, cantidad } = req.body;
    if (!idProducto || cantidad <= 0)
      return res.status(400).json({ error: 'Datos inválidos' });

    const producto = await Producto.findOne({ idProducto });
    if (!producto)
      return res.status(404).json({ error: 'Producto no encontrado' });

    const carrito = inicializarCarrito(req);
    const existente = carrito.find(p => p.idProducto === idProducto);

    if (existente) {
      existente.cantidad += cantidad;
    } else {
      carrito.push({
        idProducto,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad,
        imagen: producto.imagen
      });
    }

    req.session.carrito = carrito;
    res.json({ mensaje: 'Producto agregado al carrito', carrito });
  } catch (error) {
    console.error('Error al agregar al carrito:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/carrito/eliminar', verificarSesion, (req, res) => {
  const { idProducto } = req.body;
  const carrito = inicializarCarrito(req);
  req.session.carrito = carrito.filter(p => p.idProducto !== idProducto);
  res.json({ mensaje: 'Producto eliminado del carrito', carrito: req.session.carrito });
});

app.post('/api/carrito/vaciar', verificarSesion, (req, res) => {
  req.session.carrito = [];
  res.json({ mensaje: 'Carrito vaciado correctamente' });
});

// --- Raíz ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Inicio.html'));
});

// --- Servidor ---
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
