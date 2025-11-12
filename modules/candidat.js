const mongoose = require("mongoose");

const candidatSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  linkedin: String,
  portfolio: String,
  cvData: Buffer,               // تخزين محتوى PDF
  cvName: String,
  coverLetterData: Buffer,
  coverLetterName: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Candidat", candidatSchema);
