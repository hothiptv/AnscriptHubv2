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

// Mở khóa CORS thủ công và ngăn chặn Cache
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    
    // Ép trình duyệt và game không lưu bộ nhớ đệm (Xóa cache dữ liệu cũ)
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");
    next();
});

// Hàm hỗ trợ gọi GitHub API (Dùng HTTPS thuần của Node.js, không lo lỗi deploy Render)
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

// 1. API TRẢ VỀ JSON CHO GAME ROBLOX VÀ ADMIN DASHBOARD TẢI (/raw-hub)
// Luôn lấy dữ liệu gốc từ GitHub Repo nên dữ liệu đảm bảo đồng bộ thực tế
app.get('/raw-hub', async (req, res) => {
    try {
        if (!GITHUB_USER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({ error: "Thiếu cấu hình biến môi trường N_ANS, R_ANS, T_ANS trên Render!" });
        }

        // Tạo chuỗi ngẫu nhiên để GitHub không trả về cache cũ
        const apiPath = `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}?t=${Date.now()}`;
        const result = await githubRequest('GET', apiPath, null);

        res.setHeader('Content-Type', 'application/json');

        if (result.statusCode === 200) {
            const fileData = JSON.parse(result.body);
            // Giải mã chuỗi Base64 từ GitHub thành chuỗi JSON gốc
            const jsonString = Buffer.from(fileData.content, 'base64').toString('utf8');
            return res.status(200).send(jsonString);
        } else {
            // Nếu không tìm thấy file, trả về cấu trúc rỗng dự phòng tránh lỗi sập script
            const fallbackData = { Info: { Name: "Anscript Hub", Version: "v1.0", ThemeColor: [0, 173, 181] }, HomeTab: { Introduction: "", Elements: [] }, Tabs: [] };
            return res.status(200).json(fallbackData);
        }
    } catch (error) {
        return res.status(500).json({ error: "Lỗi kết nối GitHub API", details: error.message });
    }
});

// 2. API LƯU DỮ LIỆU TỪ TRANG WEB ADMIN DASHBOARD VÀO FILE data.json TRÊN GITHUB (/save-hub)
app.post('/save-hub', async (req, res) => {
    try {
        if (!GITHUB_USER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({ success: false, message: "Thiếu cấu hình biến GitHub trên Render!" });
        }

        const newData = req.body;
        
        // Chuẩn hóa và làm sạch dữ liệu đầu vào tránh lỗi "nil index" trong game
        if (newData && newData.Info) {
            if (!newData.Info.ThemeColor || !Array.isArray(newData.Info.ThemeColor)) {
                newData.Info.ThemeColor = [0, 173, 181];
            } else {
                newData.Info.ThemeColor = newData.Info.ThemeColor.map(val => Number(val) || 0);
            }
        }

        const apiPath = `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
        
        // Bước A: Gửi yêu cầu GET lấy mã SHA cũ của file trên GitHub (Bắt buộc phải có SHA để ghi đè)
        const getFile = await githubRequest('GET', apiPath, null);
        let sha = null;
        if (getFile.statusCode === 200) {
            const currentFile = JSON.parse(getFile.body);
            sha = currentFile.sha;
        }

        // Bước B: Định dạng lại chuỗi JSON đẹp mắt và chuyển sang mã hóa Base64
        const newContentString = JSON.stringify(newData, null, 4);
        const base64Content = Buffer.from(newContentString, 'utf8').toString('base64');

        // Tạo Body đúng cấu trúc GitHub API yêu cầu
        const commitBody = {
            message: "⚡ Auto Update data.json từ Admin Dashboard V3",
            content: base64Content,
            branch: "main"
        };
        if (sha) commitBody.sha = sha;

        // Bước C: Thực hiện đẩy (PUT) dữ liệu trực tiếp lên kho chứa GitHub
        const updateResult = await githubRequest('PUT', apiPath, commitBody);

        if (updateResult.statusCode === 200 || updateResult.statusCode === 201) {
            console.log("💾 Đồng bộ thành công dữ liệu mới lên file data.json trên GitHub!");
            return res.status(200).json({ success: true, message: "Đã lưu trực tiếp lên GitHub thành công!" });
        } else {
            console.error("❌ GitHub API từ chối: ", updateResult.body);
            return res.status(updateResult.statusCode).json({ success: false, message: "GitHub từ chối lưu file." });
        }
    } catch (error) {
        console.error("❌ Lỗi hệ thống: ", error);
        return res.status(500).json({ success: false, message: "Lỗi kết nối hệ thống khi update GitHub." });
    }
});

// Khởi động lắng nghe server
app.listen(PORT, () => {
    console.log(`🚀 Server AnscriptHub vận hành mượt mà tại cổng: ${PORT}`);
});
