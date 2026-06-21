const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================================
// 🔑 KẾT NỐI ĐẾN 3 BIẾN MÔI TRƯỜNG ÔNG ĐÃ CẤU HÌNH TRÊN RENDER
const GITHUB_USER = process.env.N_ANS;  // Tên tài khoản GitHub
const GITHUB_REPO = process.env.R_ANS;  // Tên Kho lưu trữ (Repo)
const GITHUB_TOKEN = process.env.T_ANS; // GitHub Personal Access Token (PAT)
const FILE_PATH = "data.json";          // File cần chỉnh sửa trên GitHub
// ========================================================

app.use(express.json());
app.use(express.static(__dirname));

// Mở khóa CORS thủ công
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    next();
});

// Hàm hỗ trợ gọi GitHub API (Dùng HTTPS thuần của Node.js)
function githubRequest(method, path, bodyData) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'User-Agent': 'NodeJS-Server',
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });

        req.on('error', (err) => reject(err));

        if (bodyData) {
            req.write(JSON.stringify(bodyData));
        }
        req.end();
    });
}

// 1. API TRẢ VỀ JSON CHO GAME ROBLOX TẢI (/raw-hub)
// API này lấy trực tiếp data từ GitHub Repo của ông nên luôn là dữ liệu mới nhất
app.get('/raw-hub', async (req, res) => {
    try {
        if (!GITHUB_USER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({ error: "Thiếu cấu hình biến môi trường trên Render!" });
        }

        const apiPath = `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
        const result = await githubRequest('GET', apiPath, null);

        if (result.statusCode === 200) {
            const fileData = JSON.parse(result.body);
            // Giải mã chuỗi Base64 từ GitHub thành chuỗi JSON gốc
            const jsonString = Buffer.from(fileData.content, 'base64').toString('utf8');
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).send(jsonString);
        } else {
            return res.status(result.statusCode).json({ error: "Không tìm thấy file data.json trên GitHub Repo!" });
        }
    } catch (error) {
        return res.status(500).json({ error: "Lỗi kết nối GitHub API", details: error.message });
    }
});

// 2. API LƯU DỮ LIỆU TỪ ADMIN DASHBOARD GỬI LÊN (/save-hub)
// Tự động cập nhật trực tiếp và sinh commit mới đè lên file data.json trên GitHub
app.post('/save-hub', async (req, res) => {
    try {
        if (!GITHUB_USER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({ success: false, message: "Thiếu cấu hình biến GitHub trên Render!" });
        }

        const newData = req.body;
        // Đảm bảo mảng màu ThemeColor luôn tồn tại dạng số nguyên
        if (newData && newData.Info) {
            if (!newData.Info.ThemeColor || !Array.isArray(newData.Info.ThemeColor)) {
                newData.Info.ThemeColor = [0, 173, 181];
            } else {
                newData.Info.ThemeColor = newData.Info.ThemeColor.map(val => Number(val) || 0);
            }
        }

        const apiPath = `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
        
        // Bước A: Lấy mã SHA cũ của file (GitHub bắt buộc phải có SHA mới cho ghi đè)
        const getFile = await githubRequest('GET', apiPath, null);
        let sha = null;
        if (getFile.statusCode === 200) {
            const currentFile = JSON.parse(getFile.body);
            sha = currentFile.sha;
        }

        // Bước B: Chuyển dữ liệu JSON mới thành chuỗi Base64 để gửi lên GitHub
        const newContentString = JSON.stringify(newData, null, 4);
        const base64Content = Buffer.from(newContentString, 'utf8').toString('base64');

        // Tạo body gửi cho GitHub API
        const commitBody = {
            message: "⚡ Auto Update data.json từ Admin Dashboard V3",
            content: base64Content,
            branch: "main"
        };
        if (sha) commitBody.sha = sha; // Đính kèm SHA nếu file đã tồn tại

        // Bước C: Thực hiện ghi đè/tạo mới file lên GitHub
        const updateResult = await githubRequest('PUT', apiPath, commitBody);

        if (updateResult.statusCode === 200 || updateResult.statusCode === 201) {
            console.log("✅ Đã update thành công dữ liệu mới trực tiếp lên GitHub Repo!");
            return res.status(200).json({ success: true, message: "Đã đồng bộ trực tiếp lên GitHub thành công!" });
        } else {
            console.error("❌ Lỗi GitHub trả về:", updateResult.body);
            return res.status(updateResult.statusCode).json({ success: false, message: "GitHub từ chối cập nhật file." });
        }
    } catch (error) {
        console.error("❌ Lỗi hệ thống:", error);
        return res.status(500).json({ success: false, message: "Lỗi kết nối hệ thống khi update GitHub." });
    }
});

// Khởi chạy Server
app.listen(PORT, () => {
    console.log(`🚀 Server AnscriptHub đang chạy mượt mà tại cổng: ${PORT}`);
    console.log(`🔗 Link lấy data cho game: http://localhost:${PORT}/raw-hub`);
});
