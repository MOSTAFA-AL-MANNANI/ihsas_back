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
//mongodb+srv://ihsan:admin@cluster0.n39fpvm.mongodb.net/ihsan
mongoose.connect(process.env.MONGO_URI, )
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
const Center = require("./modules/center");
const Filiere = require("./modules/filiere");



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
      process.env.JWT_SECRET ,
      
    );

    res.json({ message: 'Connexion réussie ✅', token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 🔹 Ajouter un candidat
// -----------------------------
app.post(
  '/api/candidat/add',
  upload.fields([{ name: 'cv' }, { name: 'cover' }]),
  async (req, res) => {
    try {
      const { fullName, linkedin, portfolio, filiere, center } = req.body;

      const cv = req.files?.cv?.[0];
      const cover = req.files?.cover?.[0];

      const candidat = new Candidat({
        fullName,
        linkedin,
        portfolio,
        filiere,
        center,

        // الملفات
        cvData: cv ? cv.buffer : null,
        cvName: cv ? cv.originalname : null,
        coverLetterData: cover ? cover.buffer : null,
        coverLetterName: cover ? cover.originalname : null,

        // 🟦 الحالة الأولية
        statusTracking: {
          currentStatus: "Disponible",
        },

        createdAt: new Date()
      });

      await candidat.save();

      res.json({ message: '✅ Candidat ajouté avec succès' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de l’ajout du candidat' });
    }
  }
);



// -----------------------------
// 🔹 Afficher tous les candidats (avec relations)
// -----------------------------
app.get('/api/candidat/all', verifyToken, async (req, res) => {
  try {
    const candidats = await Candidat.find()
      .populate("filiere", "name description")
      .populate("center", "name address phone")
      .sort({ createdAt: -1 });

    const data = candidats.map(c => ({
      _id: c._id,
      fullName: c.fullName,
      linkedin: c.linkedin,
      portfolio: c.portfolio,

      filiere: c.filiere,
      center: c.center,

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


// -----------------------------
// 🔹 Modifier un candidat
// -----------------------------
app.put(
  '/api/candidat/:id',
  upload.fields([{ name: 'cv' }, { name: 'cover' }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { fullName, linkedin, portfolio, filiere, center } = req.body;

      const cv = req.files?.cv?.[0];
      const cover = req.files?.cover?.[0];

      const updateData = {
        fullName,
        linkedin,
        portfolio,
        filiere,
        center
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

      if (!updated)
        return res.status(404).json({ message: "❌ Candidat non trouvé" });

      res.json({ message: "✏️ Candidat mis à jour avec succès", candidat: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);


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

// ===== CRUD لشعبة (Filiere) =====

// إنشاء شعبة جديدة
app.post("/api/filiere", async (req, res) => {
  try {
    const { name, description } = req.body;
    const filiere = new Filiere({ name, description });
    await filiere.save();
    res.status(201).json({ message: "Filière créée", filiere });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// قراءة كل الشعب
app.get("/api/filiere", async (req, res) => {
  try {
    const filieres = await Filiere.find();
    res.json(filieres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// قراءة شعبة واحدة حسب id
// app.get("/api/filiere/:id", async (req, res) => {
//   try {
//     const filiere = await Filiere.findById(req.params.id);
//     if (!filiere) return res.status(404).json({ message: "Filière non trouvée" });
//     res.json(filiere);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// تحديث شعبة
app.put("/api/filiere/:id", async (req, res) => {
  try {
    const { name, description } = req.body;
    const filiere = await Filiere.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true }
    );
    if (!filiere) return res.status(404).json({ message: "Filière non trouvée" });
    res.json({ message: "Filière mise à jour", filiere });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف شعبة
app.delete("/api/filiere/:id", async (req, res) => {
  try {
    const filiere = await Filiere.findByIdAndDelete(req.params.id);
    if (!filiere) return res.status(404).json({ message: "Filière non trouvée" });
    res.json({ message: "Filière supprimée" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CRUD للمراكز / التكوينات (Center) =====

// إنشاء مركز (center)
app.post("/api/center", async (req, res) => {
  try {
    const { name, description, address, phone } = req.body;
    const center = new Center({ name, description, address, phone });
    await center.save();
    res.status(201).json({ message: "Center créé", center });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// قراءة كل المراكز
app.get("/api/center", async (req, res) => {
  try {
    const centers = await Center.find();
    res.json(centers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// قراءة مركز واحد حسب id
app.get("/api/center/:id", async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ message: "Center non trouvé" });
    res.json(center);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحديث مركز
app.put("/api/center/:id", async (req, res) => {
  try {
    const { name, description, address, phone } = req.body;
    const center = await Center.findByIdAndUpdate(
      req.params.id,
      { name, description, address, phone },
      { new: true }
    );
    if (!center) return res.status(404).json({ message: "Center non trouvé" });
    res.json({ message: "Center mis à jour", center });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// حذف مركز
app.delete("/api/center/:id", async (req, res) => {
  try {
    const center = await Center.findByIdAndDelete(req.params.id);
    if (!center) return res.status(404).json({ message: "Center non trouvé" });
    res.json({ message: "Center supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/candidat/:id/stage", async (req, res) => {
  try {
    const { stageCompany, stageTitle, stageStartDate, stageEndDate, stageType } = req.body;

    const updated = await Candidat.findByIdAndUpdate(
      req.params.id,
      {
        statusTracking: {
          currentStatus: "En Stage",
          stageCompany,
          stageTitle,
          stageStartDate,
          stageEndDate,
          stageType,
        }
      },
      { new: true }
    );

    res.json({ message: "Stage mis à jour avec succès", updated });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//job update

app.put("/api/candidat/:id/job", async (req, res) => {
  try {
    const { jobCompany, jobTitle, jobContractType, jobStartDate } = req.body;

    const updated = await Candidat.findByIdAndUpdate(
      req.params.id,
      {
        statusTracking: {
          currentStatus: "En Travail",
          jobCompany,
          jobTitle,
          jobContractType,
          jobStartDate,
        }
      },
      { new: true }
    );

    res.json({ message: "Job mis à jour avec succès", updated });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//disponible update
app.put("/api/candidat/:id/disponible", async (req, res) => {
  try {

    const updated = await Candidat.findByIdAndUpdate(
      req.params.id,
      {
        statusTracking: {
          currentStatus: "Disponible"
        }
      },
      { new: true }
    );

    res.json({ message: "Candidat marqué comme disponible", updated });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/candidat/filter', verifyToken, async (req, res) => {
  try {
    const { center, status } = req.query;

    let filter = {};

    if (center) filter.center = center;
    if (status) filter["statusTracking.currentStatus"] = status;

    const candidats = await Candidat.find(filter)
      .populate("center", "name address")
      .populate("filiere", "name")
      .sort({ createdAt: -1 });

    res.json(candidats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API لجلب المترشحين حسب التصفية
app.get("/api/candidat/filters", verifyToken, async (req, res) => {
  try {
    const { center, filiere, status } = req.query;

    const query = {};

    if (center) query.center = center;
    if (filiere) query.filiere = filiere;
    if (status) query["statusTracking.currentStatus"] = status;

    const candidats = await Candidat.find(query)
      .populate("center", "name")
      .populate("filiere", "name");

    res.json(candidats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 📊 GET /api/stats/center/:centerId
app.get("/api/stats/center/:centerId", async (req, res) => {
  try {
    const centerId = req.params.centerId;

    const stats = await Candidat.aggregate([
      { $match: { center: new mongoose.Types.ObjectId(centerId) } },

      {
        $group: {
          _id: "$statusTracking.currentStatus",
          total: { $sum: 1 }
        }
      }
    ]);

    // تنسيق الإخراج
    const formattedStats = {
      Disponible: 0,
      "En Stage": 0,
      "En Travail": 0
    };

    stats.forEach(s => {
      formattedStats[s._id] = s.total;
    });

    res.json({
      center: centerId,
      statistics: formattedStats
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stats/center/:centerId/chart", async (req, res) => {
  try {
    const centerId = req.params.centerId;

    const stats = await Candidat.aggregate([
      { $match: { center: new mongoose.Types.ObjectId(centerId) } },
      {
        $group: {
          _id: "$statusTracking.currentStatus",
          total: { $sum: 1 }
        }
      }
    ]);

    const labels = ["Disponible", "En Stage", "En Travail"];
    const data = [0, 0, 0];

    stats.forEach(s => {
      const index = labels.indexOf(s._id);
      if (index !== -1) data[index] = s.total;
    });

    res.json({
      labels,
      datasets: [{
        label: "Nombre de candidats",
        data
      }]
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// app.get("/api/stats/centers", async (req, res) => {
//   try {
//     // تجميع (aggregation) حسب المركز + الحالة
//     const agg = await Candidat.aggregate([
//       // أولاً، نجمع حسب center and status
//       {
//         $group: {
//           _id: {
//             center: "$center",
//             status: "$statusTracking.currentStatus"
//           },
//           count: { $sum: 1 }
//         }
//       },
//       // ثم نعيد تنظيم البيانات لتكون لكل مركز مجموع الحالات
//       {
//         $group: {
//           _id: "$_id.center",
//           stats: {
//             $push: {
//               status: "$_id.status",
//               count: "$count"
//             }
//           },
//           total: { $sum: "$count" }
//         }
//       },
//       // نبدأ بضم معلومات المركز (اسم المركز مثلا)
//       {
//         $lookup: {
//           from: "centers", // اسم مجموعة الـ Center في MongoDB (تحقق منه)
//           localField: "_id",
//           foreignField: "_id",
//           as: "centerData"
//         }
//       },
//       // تبسيط المخرجات
//       {
//         $project: {
//           _id: 1,
//           center: { $arrayElemAt: ["$centerData.name", 0] },
//           total: 1,
//           stats: 1
//         }
//       }
//     ]);

//     // نرتّب المراكز بحسب أداء: مثلا حسب من لديهم Stage + Travail
//     const formatted = agg.map(item => {
//       // نفصل الأعداد لكل حالة
//       const obj = { center: item.center, total: item.total };
//       for (const s of item.stats) {
//         obj[s.status] = s.count;
//       }
//       // تأكد من وجود الحقول إذا بعضها مفقود
//       obj.Disponible = obj.Disponible || 0;
//       obj["En Stage"] = obj["En Stage"] || 0;
//       obj["En Travail"] = obj["En Travail"] || 0;
//       // حساب "أداء" كمثال: عدد Stage + travail
//       obj.performance = obj["En Stage"] + obj["En Travail"];
//       return obj;
//     });

//     // ترتيب المراكز حسب الأداء (من الأفضل إلى الأقل)
//     formatted.sort((a, b) => b.performance - a.performance);

//     res.json({ centers: formatted });

//   } catch (err) {
//     console.error("Error in stats centers:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// -----------------------------
// 🚀 تشغيل الخادم
// -----------------------------

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
