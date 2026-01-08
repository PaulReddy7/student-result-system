const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/studentDB')
    .then(() => console.log(">> ✅ MongoDB Connected Successfully"))
    .catch(err => console.error(">> ❌ MongoDB Connection Error:", err));

// Database Schema
const studentSchema = new mongoose.Schema({
    studentId: String,
    name: String,
    math: Number,
    science: Number,
    english: Number,
    status: String
});
const Student = mongoose.model('Student', studentSchema);

app.use(express.static('public'));
app.use(express.json());

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'main.html')));

app.post('/api/admin/upload', upload.single('file'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        for (let row of data) {
            const sId = String(row.ID || "").trim();
            if (sId) {
                // Matching your specific Excel headers: 'Maths' and 'Science ' (with space)
                const m = Number(row.Maths || 0);
                const s = Number(row['Science '] || 0); 
                const e = Number(row.English || 0);
                const avg = (m + s + e) / 3;

                await Student.updateOne(
                    { studentId: sId },
                    {
                        name: row.Name,
                        math: m,
                        science: s,
                        english: e,
                        status: avg >= 40 ? "Pass" : "Fail"
                    },
                    { upsert: true }
                );
            }
        }
        fs.unlinkSync(req.file.path);
        res.json({ success: true, message: "Database synced with MongoDB!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Upload failed." });
    }
});

app.get('/api/student/:id', async (req, res) => {
    const student = await Student.findOne({ studentId: req.params.id.trim() });
    student ? res.json({ success: true, data: student }) : res.status(404).json({ success: false });
});

app.listen(3000, () => console.log('🚀 Server: http://localhost:3000'));