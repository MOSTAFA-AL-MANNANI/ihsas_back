// -----------------------------
// 📦 استدعاء المكتبات الأساسية
// -----------------------------
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const path = require("path");

// تحميل متغيرات البيئة
dotenv.config();

// -----------------------------
// ⚙️ إعداد التطبيق Express
// -----------------------------
const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// 🌍 الاتصال بـ MongoDB
// -----------------------------
mongoose.connect('mongodb+srv://admin:admin@cluster0.tawg3vv.mongodb.net/ihsas')
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ Could not connect to MongoDB:', err));

// -----------------------------
// 📁 إعداد Multer لرفع الملفات
// -----------------------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// -----------------------------
// 🧩 استدعاء الموديلات
// -----------------------------
const Admin = require('./modules/admin');
const Candidat = require('./modules/candidat');



// -----------------------------
// 🔒 Middleware التحقق من الـ Token
// -----------------------------
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: '🚫 Token manquant' });

  jwt.verify(token, process.env.JWT_SECRET || 'secretKey', (err, admin) => {
    if (err) return res.status(403).json({ message: '❌ Token invalide' });
    req.admin = admin; // تخزين بيانات الأدمن في الطلب
    next();
  });
}

// -----------------------------
// 🔹 تسجيل Admin جديد
// -----------------------------
app.post('/api/admin/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const exist = await Admin.findOne({ email });
    if (exist) return res.status(400).json({ message: '📧 Email déjà utilisé' });

    const hash = await bcrypt.hash(password, 10);
    const admin = new Admin({ name, email, password: hash });
    await admin.save();

    res.json({ message: '✅ Admin créé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 🔹 تسجيل الدخول Admin
// -----------------------------
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ message: 'Admin introuvable' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: 'Mot de passe incorrect' });

    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      process.env.JWT_SECRET || 'secretKey',
      { expiresIn: '2h' }
    );

    res.json({ message: 'Connexion réussie ✅', token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 🔹 إضافة مترشح جديد
// -----------------------------
// إضافة مترشح بدون رفع الملفات على Drive
app.post('/api/candidat/add', upload.fields([{ name: 'cv' }, { name: 'cover' }]), async (req, res) => {
  try {
    const { fullName, linkedin, portfolio } = req.body;
    const cv = req.files?.cv?.[0];
    const cover = req.files?.cover?.[0];

    // حفظ الملفات مباشرة كـ buffer أو اسم الملف في MongoDB
    const candidat = new Candidat({
      fullName,
      linkedin,
      portfolio,
      cvData: cv ? cv.buffer : null,       // تخزين الملف كـ Buffer
      cvName: cv ? cv.originalname : null, // اسم الملف
      coverLetterData: cover ? cover.buffer : null,
      coverLetterName: cover ? cover.originalname : null,
      createdAt: new Date()
    });

    await candidat.save();
    res.json({ message: '✅ Candidat ajouté avec succès dans MongoDB' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement du candidat' });
  }
});


// -----------------------------
// 🔹 عرض المترشحين (محمي بـ JWT)
// -----------------------------
app.get('/api/candidat/all', verifyToken, async (req, res) => {
  try {
    const candidats = await Candidat.find().sort({ createdAt: -1 });
    
    // تحويل Buffer إلى Base64
    const data = candidats.map(c => ({
      _id: c._id,
      fullName: c.fullName,
      linkedin: c.linkedin,
      portfolio: c.portfolio,
      cvData: c.cvData ? c.cvData.toString('base64') : null,
      cvName: c.cvName,
      coverLetterData: c.coverLetterData ? c.coverLetterData.toString('base64') : null,
      coverLetterName: c.coverLetterName,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// -----------------------------
// 🔹 تسجيل الخروج (رمزي فقط)
// -----------------------------
app.post('/api/admin/logout', (req, res) => {
  // في تطبيق فعلي، يمكننا جعل الـ token منتهي أو blacklist
  res.json({ message: '🚪 Déconnexion réussie' });
});
// -----------------------------
// 🔹 Supprimer un candidat (Admin uniquement)
// -----------------------------
app.delete('/api/candidat/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Candidat.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "❌ Candidat non trouvé" });
    }
    res.json({ message: "🗑️ Candidat supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 🔹 Modifier les informations d’un candidat (Admin uniquement)
// -----------------------------


app.put('/api/candidat/:id', upload.fields([{ name: 'cv' }, { name: 'cover' }]), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, linkedin, portfolio } = req.body;
    const cv = req.files?.cv?.[0];
    const cover = req.files?.cover?.[0];

    const updateData = {
      fullName,
      linkedin,
      portfolio,
    };

    if (cv) {
      updateData.cvData = cv.buffer;
      updateData.cvName = cv.originalname;
    }

    if (cover) {
      updateData.coverLetterData = cover.buffer;
      updateData.coverLetterName = cover.originalname;
    }

    const updated = await Candidat.findByIdAndUpdate(id, updateData, { new: true });

    if (!updated) return res.status(404).json({ message: "❌ Candidat non trouvé" });

    res.json({ message: "✏️ Candidat mis à jour avec succès", candidat: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/candidat/:id/cv', async (req, res) => {
  try {
    const c = await Candidat.findById(req.params.id);
    if (!c || !c.cvData) return res.status(404).send("CV non trouvé");
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${c.cvName}"`
    });
    res.send(c.cvData);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// الحصول على lettre de motivation
app.get('/api/candidat/:id/cover', async (req, res) => {
  try {
    const c = await Candidat.findById(req.params.id);
    if (!c || !c.coverLetterData) return res.status(404).send("Lettre non trouvée");
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${c.coverLetterName}"`
    });
    res.send(c.coverLetterData);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
// -----------------------------
// 🚀 تشغيل الخادم
// -----------------------------

app.listen(3000, () => {
  console.log(`🚀 Server is running on port 3000`);
});
