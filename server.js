const express = require('express');
const { exec } = require('child_process');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Thư viện trích xuất văn bản
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Cần thiết để đọc JSON body từ Frontend gửi lên (cho phần Pandoc)

// Đảm bảo thư mục lưu file tạm tồn tại
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: 'uploads/' });

// ==========================================
// API 1: TRÍCH XUẤT TEXT TỪ FILE (Ảnh, PDF, Word)
// ==========================================
app.post('/extract-text', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Không tìm thấy file.' });

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    let extractedText = '';

    try {
        if (mime === 'application/pdf') {
            const dataBuffer = fs.readFileSync(file.path);
            const data = await pdfParse(dataBuffer);
            extractedText = data.text;
        } 
        else if (mime.includes('word') || ext === '.docx' || ext === '.doc') {
            const result = await mammoth.extractRawText({ path: file.path });
            extractedText = result.value;
        } 
        else if (mime.startsWith('image/')) {
            const result = await Tesseract.recognize(file.path, 'vie+eng');
            extractedText = result.data.text;
        } 
        else {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Định dạng không được hỗ trợ' });
        }

        // Xóa file tạm sau khi lấy text
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        
        // Trả text về cho frontend
        res.json({ success: true, text: extractedText });

    } catch (err) {
        console.error("Lỗi xử lý file:", err);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.status(500).json({ success: false, error: 'Lỗi trích xuất văn bản.' });
    }
});

// ==========================================
// API 2: XUẤT TEXT/MARKDOWN RA WORD BẰNG PANDOC
// ==========================================
app.post('/api/export-docx', (req, res) => {
    const { markdown } = req.body;

    const id = Date.now();
    const mdPath = path.join(uploadDir, `temp_${id}.md`);
    const docxPath = path.join(uploadDir, `De_Thi_AI_${id}.docx`);

    // 1. Ghi nội dung thô vào file markdown tạm
    fs.writeFileSync(mdPath, markdown, 'utf-8');

    // 2. Chạy lệnh Pandoc chuyển đổi sang docx
    const pandocCmd = `pandoc "${mdPath}" -f markdown -t docx -o "${docxPath}"`;

    exec(pandocCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Lỗi thực thi Pandoc: ${error.message}`);
            return res.status(500).send("Lỗi trong quá trình xử lý Pandoc.");
        }

        // 3. Gửi file .docx về cho client tải xuống
        res.download(docxPath, `Tai_Lieu_${id}.docx`, (err) => {
            // Xóa các file tạm sau khi gửi xong
            try {
                if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
                if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
            } catch (e) {
                console.error("Lỗi xóa file tạm:", e);
            }
        });
    });
});
// ==========================================
// API 3: XUẤT HTML RA WORD BẰNG PANDOC
// ==========================================
app.post('/api/export-docx-from-html', (req, res) => {
    const { html } = req.body;
    if (!html) return res.status(400).send("Thiếu nội dung HTML");

    const id = Date.now();
    // Tạo file tạm với đuôi .html
    const htmlPath = path.join(uploadDir, `temp_${id}.html`);
    const docxPath = path.join(uploadDir, `Tai_Lieu_HTML_${id}.docx`);

    // 1. Ghi nội dung HTML vào file tạm
    fs.writeFileSync(htmlPath, html, 'utf-8');

    // 2. Chạy lệnh Pandoc chuyển đổi từ html (-f html) sang docx
    const pandocCmd = `pandoc "${htmlPath}" -f html -t docx -o "${docxPath}"`;

    exec(pandocCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Lỗi thực thi Pandoc: ${error.message}`);
            // Xóa file tạm nếu có lỗi
            if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
            return res.status(500).send("Lỗi trong quá trình chuyển đổi HTML sang DOCX.");
        }

        // 3. Gửi file .docx về cho client
        res.download(docxPath, `Tai_Lieu_${id}.docx`, (err) => {
            // Xóa các file tạm sau khi gửi xong
            try {
                if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
                if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
            } catch (e) {
                console.error("Lỗi xóa file tạm:", e);
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server kết hợp đang chạy ở cổng ${PORT}`));
