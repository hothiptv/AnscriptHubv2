const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.js');

// Cấu hình Middleware
app.use(cors()); // Cho phép tất cả các nguồn (bao gồm cả game Roblox) kết nối tới
app.use(express.json());
app.use(express.static(__dirname)); // Để chạy giao diện HTML admin trực tiếp từ server

// ⚙️ Cấu trúc dữ liệu mặc định siêu chuẩn (Đầy đủ Info, HomeTab, Tabs)
const defaultData = {
    Info: { 
        Name: "Anscript Hub", 
        Version: "v2.5", 
        Creator: "An Bro", 
        ThemeColor: [0, 173, 181] // Luôn có mảng màu mặc định tránh lỗi index nil trong game
    },
    HomeTab: { 
        Introduction: "Chào mừng anh bạn đã quay trở lại với Anscript Hub!", 
        Elements: [
            { type: "label", text: "Hệ thống vận hành mượt mà!" }
        ] 
    },
    Tabs: [
        {
            Name: "Test",
            Sections: [
                { Name: "Khối Sức Mạnh", Scripts: [] }
            ],
            StandaloneScripts: [
                { Name: "Test Ngoài Mục", Desc: "Mô tả script test", Content: "print('Chạy ngoài mục ngon!')" }
            ]
        }
    ]
};

// Hàm đọc dữ liệu an toàn từ file JSON
function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            // Nếu chưa có file dữ liệu, tự động tạo file mới với cấu trúc chuẩn dữ phòng
            fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 4), 'utf8');
            return defaultData;
        }
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error("❌ Lỗi đọc file JSON, dùng dữ liệu mặc định:", error);
        return defaultData;
    }
}

// 1. API TRẢ VỀ JSON CHO GAME ROBLOX TẢI (Dùng link này dán vào game)
app.get('/raw-hub', (req, res) => {
    const currentData = readData();
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(currentData);
});

// 2. API LƯU DỮ LIỆU TỪ TRANG WEB ADMIN DASHBOARD
app.post('/save-hub', (req, res) => {
    try {
        const newData = req.body;

        // Kiểm tra bảo mật dữ liệu đầu vào cơ bản
        if (!newData || !newData.Info || !newData.HomeTab || !newData.Tabs) {
            return res.status(400).json({ success: false, message: "Cấu trúc dữ liệu gửi lên không hợp lệ!" });
        }

        // Đảm bảo mảng ThemeColor luôn tồn tại và đúng định dạng số
        if (!newData.Info.ThemeColor || !Array.isArray(newData.Info.ThemeColor)) {
            newData.Info.ThemeColor = [0, 173, 181];
        } else {
            newData.Info.ThemeColor = newData.Info.ThemeColor.map(val => Number(val) || 0);
        }

        // Ghi đè dữ liệu mới vào file JSON trên Render
        fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 4), 'utf8');
        console.log("💾 Đã lưu và đồng bộ dữ liệu thành công!");
        
        return res.status(200).json({ success: true, message: "Đã lưu dữ liệu lên server thành công!" });
    } catch (error) {
        console.error("❌ Lỗi khi ghi file dữ liệu:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi ghi file." });
    }
});

// Lắng nghe cổng khởi động Server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy mượt mà tại cổng: http://localhost:${PORT}`);
    console.log(`📌 API dành cho Roblox: http://localhost:${PORT}/raw-hub`);
});
