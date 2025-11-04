// create_admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config(); // si usas .env

// <- Ajusta esto si no usas .env:
const MONGO_URI = 'mongodb+srv://zama1235_db_user:FyZTjThcMNbn9lzX@aplicaciondwm.pgyb5x7.mongodb.net/jugueteria?retryWrites=true&w=majority&appName=AplicacionDWM';

// Conecta a Mongo
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Conectado a MongoDB');
  run();
}).catch(err => {
  console.error('Error al conectar a Mongo:', err);
  process.exit(1);
});

// Define esquema minimal para insertar
const userSchema = new mongoose.Schema({
  username: String,
  email:    { type: String, unique: true },
  password: String,
  role:     String
});
const User = mongoose.model('User', userSchema);

async function run() {
  try {
    const email = 'admin@jugueteria.com';
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Ya existe un admin con ese email:', email);
      process.exit(0);
    }

    const plain = 'admin123'; // cambia si quieres otra contraseña
    const hash = await bcrypt.hash(plain, 10);

    const admin = new User({
      username: 'Admin',
      email,
      password: hash,
      role: 'admin'
    });
    await admin.save();
    console.log('Admin creado');
    console.log(`email: ${email}`);
    console.log(`password: ${plain}`);
    process.exit(0);
  } catch (err) {
    console.error('Error creando admin:', err);
    process.exit(1);
  }
}
