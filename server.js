const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });
const SALT_ROUNDS = 10;

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/studentDB')
    .then(() => console.log(">> ✅ Secure Database Connected"))
    .catch(err => console.error(">> ❌ Connection Error:", err));

// --- SCHEMAS ---
const studentSchema = new mongoose.Schema({
    studentId: { type: String, unique: true },
    name: String,
    email: String,
    password: { type: String }, // Hashed
    math: Number,
    science: Number,
    english: Number,
    status: String
});

const announcementSchema = new mongoose.Schema({
    text: String,
    date: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);

app.use(express.static('public'));
app.use(express.json());

// --- ANNOUNCEMENT ROUTES ---
app.get('/api/announcements', async (req, res) => {
    const list = await Announcement.find().sort({ date: -1 }).limit(3);
    res.json(list);
});

app.post('/api/admin/announcement', async (req, res) => {
    try {
        const freshNotice = new Announcement({ text: req.body.text });
        await freshNotice.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// --- AUTHENTICATION ---
// Admin Login (Static)
app.post('/api/admin/login', (req, res) => {
    const { user, pass } = req.body;
    if (user === 'admin' && pass === 'password123') {
        res.json({ success: true });
    } else { res.status(401).json({ success: false }); }
});

// Student Login (Hashed)
app.post('/api/student/login', async (req, res) => {
    const { id, password } = req.body;
    const student = await Student.findOne({ studentId: id });
    if (student && student.password) {
        const match = await bcrypt.compare(password, student.password);
        if (match) return res.json({ success: true, data: student });
    }
    res.status(401).json({ success: false, message: "Invalid ID or Password" });
});

// --- ADMIN FEATURES ---
// Live Search
app.get('/api/admin/search', async (req, res) => {
    const query = req.query.q;
    const results = await Student.find({
        $or: [
            { name: { $regex: query, $options: 'i' } },
            { studentId: { $regex: query, $options: 'i' } }
        ]
    }).limit(5);
    res.json(results);
});

// Excel Upload with Hashing
app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        for (let row of data) {
            const sId = String(row.ID || "").trim();
            if (sId) {
                const m = Number(row.Maths || 0);
                const s = Number(row['Science '] || 0);
                const e = Number(row.English || 0);
                const avg = (m + s + e) / 3;

                // Default password is "Student123" hashed
                const hashedPassword = await bcrypt.hash("Student123", SALT_ROUNDS);

                await Student.updateOne(
                    { studentId: sId },
                    {
                        name: row.Name,
                        email: row.Email || "",
                        password: hashedPassword, 
                        math: m, science: s, english: e,
                        status: avg >= 40 ? "Pass" : "Fail"
                    },
                    { upsert: true }
                );
            }
        }
        fs.unlinkSync(req.file.path);
        res.json({ success: true, message: "Data Synced and Passwords Hashed!" });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.listen(3000, () => console.log('🚀 Server running at http://localhost:3000'));