const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 🧱 Tạo folder public nếu chưa có
const uploadDir = path.join(__dirname, '../../../public');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ⚙️ Cấu hình multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

// 🧩 API upload file
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  // Trả về đường dẫn public
  const fileUrl = `/public/${req.file.filename}`;
  res.json({
    message: 'Upload successful',
    url: fileUrl,
  });
});

// 🧩 API truy cập file (phục vụ public folder)
// router.get('/public/:filename', (req, res) => {
//   const filePath = path.join(uploadDir, req.params.filename);
//   if (!fs.existsSync(filePath)) {
//     return res.status(404).json({ message: 'File not found' });
//   }
//   res.sendFile(filePath);
// });

module.exports = router;
