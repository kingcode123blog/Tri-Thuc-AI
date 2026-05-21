const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const cors = require('cors');
   app.use(cors()); // Cho phép file HTML ở ngoài kết nối vào server này
app.use(express.json());

app.post('/api/export-docx', (req, res) => {
    const { markdown } = req.body;
    if (!markdown) return res.status(400).send("Thiếu nội dung Markdown");

    const id = Date.now();
    const mdPath = path.join(__dirname, `temp_${id}.md`);
    const docxPath = path.join(__dirname, `De_Thi_AI_${id}.docx`);

    // 1. Ghi nội dung thô vào file markdown tạm
    fs.writeFileSync(mdPath, markdown, 'utf-8');

    // 2. Chạy lệnh Pandoc chuyển đổi sang docx
    // Pandoc tự động nhận diện công thức dạng $...$ hoặc $$...$$ để chuyển sang dạng Equation của Word
    const pandocCmd = `pandoc "${mdPath}" -f markdown -t docx -o "${docxPath}"`;

    exec(pandocCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Lỗi thực thi Pandoc: ${error.message}`);
            return res.status(500).send("Lỗi trong quá trình xử lý công thức toán bằng Pandoc.");
        }

        // 3. Gửi file .docx về cho client tải xuống
        res.download(docxPath, 'De_Thi_AI.docx', (err) => {
            // Xóa các file tạm sau khi gửi xong để tránh đầy ổ cứng
            try {
                if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
                if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
            } catch (e) {
                console.error("Lỗi xóa file tạm:", e);
            }
        });
    });
});
app.listen(3000, () => console.log('Server Pandoc đang chạy ở cổng 3000'));
