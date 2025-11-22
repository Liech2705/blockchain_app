var User = require("../model/User");
const Order = require("../model/Order");
const BlockchainTx = require("../model/BlockchainTx");
var Event = null;
const { ethers } = require('ethers');
require('dotenv').config(); // Để đọc .env

module.exports = function (app) {

    // lazy-require Event so models are available after mongoose connects
    try { Event = require('../model/Event'); } catch (e) { /* ignore */ }
    const SERVER_PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!SERVER_PRIVATE_KEY) console.error("❌ CHƯA CẤU HÌNH PRIVATE KEY TRONG .ENV");
    const wallet = new ethers.Wallet(SERVER_PRIVATE_KEY);

    app.get("/", function (req, res) {
        res.render("layout");
    });

    // GET /detail?id=<eventId> -> show event detail
    app.get('/detail', async function (req, res) {
        try {
            const id = req.query.id;
            if (!id) return res.status(400).send('Missing id');
            if (!Event) Event = require('../model/Event');
            const event = await Event.findById(id).lean();
            if (!event) return res.status(404).send('Event not found');
            res.render('detail', { event });
        } catch (err) {
            console.error('Error GET /detail:', err);
            res.status(500).send('Server error');
        }
    });

    // GET /category/:name -> list events in a category
    app.get('/category/:name', async function (req, res) {
        try {
            const name = req.params.name;
            if (!Event) Event = require('../model/Event');
            const events = await Event.find({ category: name }).lean();
            res.render('category', { events, categoryName: name });
        } catch (err) {
            console.error('Error GET /category/:name', err);
            res.status(500).send('Server error');
        }
    });

    // ==================== FORM ĐĂNG KÝ (có thể kèm eventId) ====================
    app.get('/dangky', async function (req, res) {
        const eventId = req.query.eventId || '';
        let event = null;

        if (eventId) {
            try {
                event = await Event.findById(eventId).lean();
            } catch (e) {
                console.error("Event không tồn tại:", eventId);
            }
        }

        res.render('dangky', { eventId, event });
    });

    // ==================== XỬ LÝ ĐĂNG KÝ ====================
    app.post("/dangky", async function (req, res) {
        try {
            const { Email, HoTen, SoDT, eventId = '' } = req.body;

            if (!Email || !HoTen || !SoDT) {
                return res.json({ ketqua: 0, maloi: "Thiếu dữ liệu" });
            }

            // Cập nhật hoặc tạo mới user
            let user = await User.findOne({ Email });
            if (user) {
                user.HoTen = HoTen;
                user.SoDT = SoDT;
            } else {
                user = new User({ Email, HoTen, SoDT });
            }
            await user.save();

            res.json({ ketqua: 1, thongbao: "Đăng ký thành công" });

        } catch (err) {
            console.error("Lỗi POST /dangky:", err);
            res.json({ ketqua: 0, maloi: "Lỗi server" });
        }
    });

    // ==================== TRANG THANH TOÁN (ORDER) ====================
    app.get('/order', async function (req, res) {
        try {
            const { eventId, email } = req.query;

            if (!eventId || !email) {
                return res.status(400).send('Thiếu thông tin eventId hoặc email');
            }

            const event = await Event.findById(eventId).lean();
            if (!event) return res.status(404).send('Không tìm thấy sự kiện');

            const user = await User.findOne({ Email: email }).lean();
            if (!user) return res.status(404).send('Không tìm thấy người dùng');

            res.render('order', { event, user });

        } catch (err) {
            console.error('Error GET /order:', err);
            res.status(500).send('Lỗi server');
        }
    });

    // ==================== TẠO ĐƠN HÀNG (QUAN TRỌNG NHẤT) ====================

    // TẠO ĐƠN HÀNG PENDING
    app.post('/create-pending-order', async (req, res) => {
        try {
            const { eventId, userId, ticketType, quantity, totalAmount } = req.body;

            const order = new Order({
                userId,
                eventId,
                ticketType,
                quantity: parseInt(quantity),
                totalAmount: parseInt(totalAmount),
                status: "pending",  // ← Quan trọng
                createdAt: new Date()
            });

            await order.save();
            res.json({ success: true, orderId: order._id });

        } catch (err) {
            console.error(err);
            res.json({ success: false, message: err.message });
        }
    });

    app.post('/api/get-signature', async (req, res) => {
        try {
            const { orderId, userAddress } = req.body;

            // 1. Lấy đơn hàng từ DB để biết giá chuẩn
            const order = await Order.findById(orderId);
            if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

            // 2. Tính toán giá trị ETH (Logic này nên nằm ở Server để bảo mật)
            // Giả sử 1 ETH = 23,000,000 VND (Thực tế nên dùng API lấy giá live)
            const FAKE_RATE = 100000000;
            const amountInCFX = order.totalAmount / FAKE_RATE;

            // Chuyển sang Wei (Đơn vị nhỏ nhất của Blockchain)
            // toFixed(18) để tránh lỗi số học JS, nhưng ethers cần chuỗi string
            const priceWei = ethers.parseEther(amountInCFX.toFixed(18));

            console.log(`Server đang ký vé ${orderId}`);
            console.log(`- Giá gốc: ${order.totalAmount} VND`);
            console.log(`- Giá Test: ${amountInCFX} CFX`);

            // 3. TẠO HASH (Băm dữ liệu) - Khớp 100% với Solidity
            const messageHash = ethers.solidityPackedKeccak256(
                ["string", "uint256", "address"],
                [
                    // Chuyển OrderID (String MongoDB) sang số (hoặc Hash) để Solidity hiểu
                    // Mẹo: Để đơn giản cho người mới, ta dùng BigInt của 1 con số hash từ string ID
                    // Hoặc nếu bạn dùng OrderId là số tự tăng thì điền số vào.
                    // Ở đây tui hash cái ID mongodb thành số để vừa lòng Solidity uint256
                    orderId.toString(),
                    priceWei,
                    userAddress
                ]
            );

            // 4. KÝ TÊN
            const messageBytes = ethers.getBytes(messageHash);
            const signature = await wallet.signMessage(messageBytes);

            // 5. Trả về
            res.json({
                // Trả về đúng cái ID dạng số đã hash để Frontend gửi lên Contract
                orderId: orderId.toString(),
                price: priceWei.toString(),
                signature: signature
            });

        } catch (error) {
            console.error("Lỗi ký tên:", error);
            res.status(500).json({ error: "Lỗi Server: " + error.message });
        }
    });

    // =========================================================
    // API CẬP NHẬT TRẠNG THÁI THÀNH CÔNG
    // =========================================================
    app.post('/update-order-success', async (req, res) => {
        try {
            const { orderId, txHash, fromAddress, toAddress, network, status, amount } = req.body;
            // Cập nhật DB
            await Order.findByIdAndUpdate(orderId, {
                status: "completed",
                updatedAt: new Date()
            });

            const txRecord = new BlockchainTx({
                orderId,
                txHash,
                fromAddress,
                toAddress,
                network,
                amount,
                status,
                createdAt: new Date()
            });
            await txRecord.save();
            res.json({ success: true });
        } catch (e) {
            res.json({ success: false });
        }
    });
}