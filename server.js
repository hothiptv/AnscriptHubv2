const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 🎯 ĐÃ ĐỔI THÀNH data.json THEO ĐÚNG FILE CỦA ÔNG BRO
const DATA_FILE = path.join(__dirname, 'data.json');

// Cấu hình Middleware
app.use(express.json());
app.use(express.static(__dirname)); // Chạy giao diện HTML Admin trực tiếp từ server

// Mở khóa CORS thủ công (Không cần thư viện 'cors' ngoài, không lo lỗi deploy Render)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
});

// Cấu trúc dữ liệu mẫu dự phòng (Nếu chưa có file data.json, server tự tạo bản chuẩn này)
const defaultData = {
    Info: { 
        Name: "Anscript Hub", 
        Version: "v2.5", 
        Creator: "An Bro", 
        ThemeColor: [0, 173, 181] // Mảng màu chuẩn để game không bị báo đỏ index nil
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
                { Name: "Test Ngoài Mục", Desc: "Mô tả script test", Content: "print('Chạy ngon lành!')" }
            ]
        }
    ]
};

// Hàm đọc dữ liệu an toàn từ file data.json
function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            // Nếu file data.json chưa tồn tại trên server, tự động tạo mới
            fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 4), 'utf8');
            return defaultData;
        }
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error("❌ Lỗi đọc file data.json, sử dụng dữ liệu mặc định:", error);
        return defaultData;
    }
}

// 1. API TRẢ VỀ JSON CHO GAME ROBLOX TẢI (/raw-hub)
app.get('/raw-hub', (req, res) => {
    const currentData = readData();
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(currentData);
});

// 2. API LƯU DỮ LIỆU TỪ ADMIN DASHBOARD GỬI LÊN (/save-hub)
app.post('/save-hub', (req, res) => {
    try {
        const newData = req.body;

        // Kiểm tra cấu trúc dữ liệu cơ bản gửi lên
        if (!newData || !newData.Info || !newData.HomeTab || !newData.Tabs) {
            return res.status(400).json({ success: false, message: "Cấu trúc dữ liệu không hợp lệ!" });
        }

        // Đảm bảo mảng màu ThemeColor luôn tồn tại dạng số nguyên
        if (!newData.Info.ThemeColor || !Array.isArray(newData.Info.ThemeColor)) {
            newData.Info.ThemeColor = [0, 173, 181];
        } else {
            newData.Info.ThemeColor = newData.Info.ThemeColor.map(val => Number(val) || 0);
        }

        // Ghi đè dữ liệu mới vào file data.json
        fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 4), 'utf8');
        console.log("💾 Đã ghi dữ liệu mới vào file data.json thành công!");
        
        return res.status(200).json({ success: true, message: "Đã lưu dữ liệu vào data.json thành công!" });
    } catch (error) {
        console.error("❌ Lỗi khi ghi dữ liệu vào data.json:", error);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi ghi file." });
    }
});

// Khởi chạy Server
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy mượt mà tại cổng: http://localhost:${PORT}`);
    console.log(`📌 Link raw cho Roblox: http://localhost:${PORT}/raw-hub`);
});
