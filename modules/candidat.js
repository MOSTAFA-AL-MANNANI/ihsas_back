const mongoose = require("mongoose");

const candidatSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  linkedin: String,
  portfolio: String,

  // Relation avec Filiere
  filiere: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Filiere",
    required: true
  },

  // Relation avec Center
  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Center",
    required: true
  },

  cvData: Buffer,
  cvName: String,

  coverLetterData: Buffer,
  coverLetterName: String,

    // 🟦 حالة المترشح (Tracking Status)
  statusTracking: {
    currentStatus: {
      type: String,
      enum: ["Disponible", "Stage", "Emploi"],
      default: "Disponible"
    },

    // 🔵 STAGE
    stageCompany: String,
    stageTitle: String,
    stageStartDate: Date,
    stageEndDate: Date,
    stageType: { type: String },

    // 🔴 JOB
    jobCompany: String,
    jobTitle: String,
    jobContractType: String,
    jobStartDate: Date,
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Candidat", candidatSchema);
