import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 8001; // FIXED: Moved to 8001 to avoid conflict with Python api.py on 8000

const app = express();
app.use(morgan('dev'));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Placeholder server as user requested to restore earlier Python face recognition
app.get('/health', (req, res) => {
  res.json({ status: "ok", mode: "node-proxy", python_port: 8000 });
});

// If the user still wants to use the registration endpoint I added, we keep it here
app.post('/register', async (req, res) => {
  try {
    const { name, images } = req.body;
    if (!name || !images || !Array.isArray(images)) {
      return res.status(400).json({ status: "fail", reason: "Name and images array required" });
    }

    const personDir = path.join(__dirname, name);
    if (!fs.existsSync(personDir)) {
      fs.mkdirSync(personDir, { recursive: true });
    }

    let savedCount = 0;
    for (let i = 0; i < images.length; i++) {
        try {
            const base64Data = images[i].replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = `sample_${Date.now()}_${i}.jpg`;
            fs.writeFileSync(path.join(personDir, fileName), buffer);
            savedCount++;
        } catch (e) {
            console.error(`Failed to save image ${i} for ${name}:`, e.message);
        }
    }

    res.json({ status: "success", message: `Registered ${savedCount} samples for ${name}. Please restart Python API to reload models.` });
  } catch (err) {
    console.error("[REGISTER ERROR]", err);
    res.status(500).json({ status: "fail", reason: "Internal Server Error" });
  }
});

const ATTENDANCE_FILE = path.join(__dirname, 'attendance.json');
const ATTENDANCE_CSV = path.join(__dirname, 'attendance.csv');

app.post('/sync-sheets', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: "fail", reason: "URL required" });

    console.log(`[SYNC] Fetching from: ${url}`);
    const response = await fetch(url);
    const csvContent = await response.text();
    
    if (!csvContent || csvContent.trim() === "") {
        return res.json({ status: "success", message: "Sheet is empty. No data synced.", count: 0 });
    }

    const lines = csvContent.split('\n');
    const header = lines[0].split(',');
    
    // Simple CSV parser
    const newRecords = [];
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < 2) continue;
        
        const record = {};
        header.forEach((col, idx) => {
            record[col.trim().toLowerCase()] = row[idx] ? row[idx].trim() : "";
        });
        
        // Map to our internal JSON format
        newRecords.push({
            type: "known",
            name: record.name || "Unknown",
            usn: record.usn || "N/A",
            date: record.date || new Date().toISOString().split('T')[0],
            time: record.time || "00:00:00",
            session: record.session || "Synced",
            status: record.status || "Present",
            confidence: parseFloat(record.confidence) || 100.0
        });
    }

    // Load existing
    let existing = [];
    if (fs.existsSync(ATTENDANCE_FILE)) {
        try {
            const content = fs.readFileSync(ATTENDANCE_FILE, 'utf8');
            existing = content ? JSON.parse(content) : [];
        } catch (e) {
            existing = [];
        }
    }

    // Deduplicate based on name, date, and session if present
    const existingKeys = new Set(existing.map(r => `${r.usn}_${r.date}_${r.session}`));
    const filteredNew = newRecords.filter(r => !existingKeys.has(`${r.usn}_${r.date}_${r.session}`));

    const finalRecords = [...existing, ...filteredNew];
    
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(finalRecords, null, 4));
    
    res.json({ 
        status: "success", 
        message: `Synced ${filteredNew.length} new records.`, 
        total: finalRecords.length,
        count: filteredNew.length
    });

  } catch (err) {
    console.error("[SYNC ERROR]", err);
    res.status(500).json({ status: "fail", reason: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📦 Node Aux Server running on http://0.0.0.0:${PORT}`);
  console.log(`🚀 Python Face API should be running on http://0.0.0.0:8000`);
});
