const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Biến môi trường kết nối GitHub
const GITHUB_USER = process.env.N_ANS;
const GITHUB_REPO = process.env.R_ANS;
const GITHUB_TOKEN = process.env.T_ANS;
const FILE_PATH = "data.json";

app.use(express.json());
app.use(express.static(__dirname));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");
    next();
});

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

// 1. API Lấy dữ liệu Hub
app.get('/raw-hub', async (req, res) => {
    try {
        if (!GITHUB_USER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({ error: "Thiếu cấu hình biến môi trường N_ANS, R_ANS, T_ANS trên Render!" });
        }

        const apiPath = `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}?t=${Date.now()}`;
        const result = await githubRequest('GET', apiPath, null);

        res.setHeader('Content-Type', 'application/json');

        if (result.statusCode === 200) {
            const fileData = JSON.parse(result.body);
            const jsonString = Buffer.from(fileData.content, 'base64').toString('utf8');
            return res.status(200).send(jsonString);
        } else {
            const fallbackData = { Info: { Name: "Anscript Hub", Version: "v1.0", ThemeColor: [0, 173, 181] }, HomeTab: { Introduction: "", Elements: [] }, Tabs: [] };
            return res.status(200).json(fallbackData);
        }
    } catch (error) {
        return res.status(500).json({ error: "Lỗi kết nối GitHub API", details: error.message });
    }
});

// 2. API Lưu dữ liệu lên GitHub
app.post('/save-hub', async (req, res) => {
    try {
        if (!GITHUB_USER || !GITHUB_REPO || !GITHUB_TOKEN) {
            return res.status(500).json({ success: false, message: "Thiếu cấu hình biến GitHub trên Render!" });
        }

        const newData = req.body;
        
        if (newData && newData.Info) {
            if (!newData.Info.ThemeColor || !Array.isArray(newData.Info.ThemeColor)) {
                newData.Info.ThemeColor = [0, 173, 181];
            } else {
                newData.Info.ThemeColor = newData.Info.ThemeColor.map(val => Number(val) || 0);
            }
        }

        const apiPath = `/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
        
        const getFile = await githubRequest('GET', apiPath, null);
        let sha = null;
        if (getFile.statusCode === 200) {
            const currentFile = JSON.parse(getFile.body);
            sha = currentFile.sha;
        }

        const newContentString = JSON.stringify(newData, null, 4);
        const base64Content = Buffer.from(newContentString, 'utf8').toString('base64');

        const commitBody = {
            message: "⚡ Auto Update data.json từ Admin Dashboard V3",
            content: base64Content,
            branch: "main"
        };
        if (sha) commitBody.sha = sha;

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

app.listen(PORT, () => {
    console.log(`🚀 Server AnscriptHub vận hành mượt mà tại cổng: ${PORT}`);
});
