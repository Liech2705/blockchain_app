// seed.js
const mongoose = require("mongoose");

const User = require("./model/User");
const Event = require("./model/Event");
const Order = require("./model/Order");
const BlockchainTx = require("./model/BlockchainTx");
const Checkin = require("./model/Checkin");

// ============================
// 1. KẾT NỐI DATABASE
// ============================
mongoose.connect("mongodb+srv://buyticks:fiwwk5RplW4um9Yp@cluster0.uof7z92.mongodb.net/buyticks?retryWrites=true&w=majority")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ MongoDB Error:", err));

// ============================
// 2. CHÈN DỮ LIỆU MẪU
// ============================

async function seedData() {
    try {
        // Xóa toàn bộ dữ liệu cũ (tùy chọn - bỏ comment nếu muốn reset)
        // await mongoose.connection.dropDatabase();

        console.log("🔄 Bắt đầu seeding dữ liệu...");

        // ===== USERS =====
        let user = await User.findOne({ Email: "a@gmail.com" });
        if (!user) {
            user = await User.create({
                HoTen: "Nguyễn Văn A",
                Email: "a@gmail.com",
                password: "123456",
                walletAddress: "0x123456789abcdef",
                SoDT: "0987654321",
                role: "user",
                status: "active"
            });
            console.log("✅ Tạo user mẫu");
        } else {
            console.log("⏭️ User đã tồn tại");
        }

        // ===== EVENTS =====
        let event = await Event.findOne({ title: "Music Festival 2025" });
        if (!event) {
            event = await Event.create({
                title: "Music Festival 2025",
                description: "Sự kiện âm nhạc lớn nhất Việt Nam 2025.",
                location: "Sân vận động Mỹ Đình, Hà Nội",
                thumbnail: "https://image.com/thumb.jpg",
                images: ["https://image.com/img1.jpg", "https://image.com/img2.jpg"],
                startDate: new Date("2025-12-25"),
                endDate: new Date("2025-12-26"),
                category: "Concert",
                status: "public",
                type_name: "General",
                quantity_total: 2500,
                quantity_sold: 0,
                ticket_status: "ACTIVE"
            });
            console.log("✅ Tạo event mẫu");
        } else {
            console.log("⏭️ Event đã tồn tại");
        }

        // Ticket types are now merged into Event - no separate TicketType collection

        // ===== ORDERS =====
        let order = await Order.findOne({ userId: user._id });
        if (!order) {
            order = await Order.create({
                userId: user._id,
                items: [
                    {
                        ticketTypeId: ticketVIP._id,
                        quantity: 2,
                        price: ticketVIP.price
                    }
                ],
                totalAmount: ticketVIP.price * 2,
                paymentMethod: "crypto",
                status: "pending"
            });
            console.log("✅ Tạo order mẫu");
        } else {
            console.log("⏭️ Order đã tồn tại");
        }

        // ===== BLOCKCHAIN TRANSACTIONS =====
        let tx = await BlockchainTx.findOne({ orderId: order._id });
        if (!tx) {
            tx = await BlockchainTx.create({
                orderId: order._id,
                userId: user._id,
                txHash: "0x111222333444555",
                fromAddress: user.walletAddress,
                toAddress: ticketVIP.smartContractAddress,
                network: "Polygon",
                amount: "0.024",
                status: "pending"
            });
            console.log("✅ Tạo blockchain transaction mẫu");
        } else {
            console.log("⏭️ Blockchain transaction đã tồn tại");
        }

        // No longer creating separate Ticket documents — events now represent listings

        // ===== CHECKIN LOGS =====
        let checkin = await Checkin.findOne({ ticketId: ticket1._id });
        if (!checkin) {
            checkin = await Checkin.create({
                ticketId: ticket1._id,
                eventId: event._id,
                scanTime: new Date(),
                scanner: "admin123"
            });
            console.log("✅ Tạo checkin log mẫu");
        } else {
            console.log("⏭️ Checkin log đã tồn tại");
        }

        console.log("\n✨ DỮ LIỆU MẪU ĐÃ ĐƯỢC TẠO/CẬP NHẬT THÀNH CÔNG!");
        console.log("\n📊 Tóm tắt dữ liệu:");
        console.log("- Users:", await User.countDocuments());
        console.log("- Events:", await Event.countDocuments());
        console.log("- Ticket Types:", await TicketType.countDocuments());
        console.log("- Orders:", await Order.countDocuments());
        // TicketType collection removed - ticket data now merged into Events
        console.log("- Blockchain TXs:", await BlockchainTx.countDocuments());
        console.log("- Checkins:", await Checkin.countDocuments());

    } catch (err) {
        console.error("❌ Lỗi trong seedData:", err);
    } finally {
        mongoose.connection.close();
    }
}

seedData();
