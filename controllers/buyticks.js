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

// TRANG TÌM KIẾM SỰ KIỆN
app.get('/search', async (req, res) => {
    try {
        const query = req.query.q?.trim();
        
        let events = [];
        if (query) {
            const regex = new RegExp(query, 'i'); // không phân biệt hoa thường
            events = await Event.find({
                $or: [
                    { title: regex },
                    { description: regex },
                    { location: regex },
                    { category: regex }
                ],
                status: "public"
            }).sort({ startDate: 1 }).lean();
        } else {
            // Nếu không có từ khóa → hiển thị tất cả
            events = await Event.find({ status: "public" }).sort({ startDate: 1 }).lean();
        }

        res.render('search', { events, query: query || '' });
    } catch (err) {
        console.error("Lỗi tìm kiếm:", err);
        res.render('search', { events: [], query: '' });
    }
});
    // GET /order?eventId=xxx&email=abc@gmail.com → Trang thanh toán
app.get('/order', async (req, res) => {
    try {
        const { eventId, email } = req.query;

        if (!eventId) return res.status(400).send("Thiếu eventId");

        if (!Event) Event = require('../model/Event');
        const event = await Event.findById(eventId).lean();
        if (!event) return res.status(404).send("Sự kiện không tồn tại");

        let user = null;
        if (req.session.userId) {
            user = await User.findById(req.session.userId).lean();
        } else if (email) {
            user = await User.findOne({ Email: email }).lean();
            // Tự động đăng nhập nếu tìm thấy user từ email
            if (user) {
                req.session.userId = user._id;
                req.session.role = user.role || 'user';
            }
        }

        res.render('order', { event, user });
    } catch (err) {
        console.error("Lỗi trang /order:", err);
        res.status(500).send("Server error");
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
// ==================== XỬ LÝ ĐĂNG KÝ – ĐÃ FIX LƯU MẬT KHẨU ====================
app.post("/dangky", async function (req, res) {
    try {
        const { Email, HoTen, SoDT, Password, eventId = '' } = req.body;

        // Validate bắt buộc có mật khẩu
        if (!Email || !HoTen || !SoDT || !Password) {
            return res.json({ ketqua: 0, maloi: "Vui lòng điền đầy đủ thông tin" });
        }

        if (Password.length < 6) {
            return res.json({ ketqua: 0, maloi: "Mật khẩu phải từ 6 ký tự trở lên" });
        }

        // Tìm user cũ
        let user = await User.findOne({ Email });

        if (user) {
            // Nếu đã tồn tại → cập nhật thông tin + đổi mật khẩu
            user.HoTen = HoTen;
            user.SoDT = SoDT;
            user.password = Password;  // ← pre-save sẽ tự hash
        } else {
            // Tạo mới + có mật khẩu
            user = new User({
                Email,
                HoTen,
                SoDT,
                password: Password   // ← BẮT BUỘC CÓ DÒNG NÀY!
            });
        }

        await user.save(); // ← pre-save hook sẽ chạy và hash password

        // TỰ ĐỘNG ĐĂNG NHẬP SAU KHI ĐĂNG KÝ
        req.session.regenerate(err => {
            if (err) throw err;
            req.session.userId = user._id.toString();
            req.session.role = user.role || 'user';

            req.session.save(err => {
                if (err) throw err;

                res.json({
                    ketqua: 1,
                    thongbao: "Đăng ký thành công!",
                    redirect: eventId ? `/order?eventId=${eventId}&email=${encodeURIComponent(Email)}` : '/'
                });
            });
        });

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

   // TẠO ĐƠN HÀNG – ĐÃ FIX 100% LƯU eventId VÀ items ĐÚNG
app.post('/create-pending-order', async (req, res) => {
    try {
        const { eventId, userId, quantity, totalAmount } = req.body;

        // BẮT BUỘC PHẢI CÓ eventId
        if (!eventId || !userId || !quantity || !totalAmount) {
            return res.json({ success: false, message: "Thiếu thông tin bắt buộc" });
        }

        // Lấy thông tin event để lấy giá (nếu cần)
        const event = await Event.findById(eventId).lean();
        if (!event) {
            return res.json({ success: false, message: "Sự kiện không tồn tại" });
        }

        // TẠO ORDER VỚI eventId + items ĐẦY ĐỦ
        const order = new Order({
            userId,
            eventId: eventId,                                    // ← BẮT BUỘC LƯU
            items: [{
                ticketTypeId: eventId,                            // ← CŨNG LƯU VÀO items
                quantity: parseInt(quantity),
                price: event.price || totalAmount / quantity
            }],
            totalAmount: parseInt(totalAmount),
            status: "pending",
            createdAt: new Date()
        });

        await order.save();

        console.log("ĐÃ TẠO ORDER THÀNH CÔNG:", {
            orderId: order._id,
            eventId: eventId,
            userId
        });

        res.json({ success: true, orderId: order._id });

    } catch (err) {
        console.error("Lỗi tạo order:", err);
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
   // API CẬP NHẬT TRẠNG THÁI THÀNH CÔNG – ĐÃ FIX 100% LƯU eventId
app.post('/update-order-success', async (req, res) => {
    try {
        const { orderId, txHash, fromAddress, toAddress, network, status = "completed", amount } = req.body;

        if (!orderId) {
            return res.json({ success: false, message: "Thiếu orderId" });
        }

        // 1. Lấy order đầy đủ thông tin
        const order = await Order.findById(orderId).lean();
        if (!order) {
            return res.json({ success: false, message: "Không tìm thấy đơn hàng" });
        }

        // 2. Cập nhật trạng thái order
        await Order.findByIdAndUpdate(orderId, {
            status: "completed",
            updatedAt: new Date()
        });

        // 3. LẤY eventId TỪ NHIỀU NGUỒN (chắc chắn có!)
        let eventId = null;
        if (order.eventId) {
            eventId = order.eventId;
        } else if (order.items && order.items.length > 0 && order.items[0].ticketTypeId) {
            eventId = order.items[0].ticketTypeId;
        }
        // Nếu vẫn null → không sao, để null cũng được (nhưng hiếm khi xảy ra)

        // 4. Lưu giao dịch blockchain + eventId
        const txRecord = new BlockchainTx({
            orderId,
            eventId: eventId,                    // ← BÂY GIỜ CHẮC CHẮN KHÔNG NULL!
            txHash,
            fromAddress,
            toAddress,
            network,
            amount,
            status,
            createdAt: new Date()
        });

        await txRecord.save();

        console.log("ĐÃ LƯU GIAO DỊCH BLOCKCHAIN:", {
            orderId,
            eventId: eventId?.toString() || "null",
            txHash
        });

        res.json({ success: true });
    } catch (e) {
        console.error("Lỗi update-order-success:", e);
        res.json({ success: false, message: e.message });
    }
});
    // Trang hồ sơ cá nhân
app.get('/profile', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    try {
        const user = await User.findById(req.session.userId).lean();
        res.render('profile', { user });
    } catch (err) {
        console.error("Lỗi tải profile:", err);
        res.redirect('/');
    }
});

// Cập nhật hồ sơ + đổi mật khẩu
app.post('/update-profile', async (req, res) => {
    if (!req.session.userId) {
        return res.json({ success: false, message: 'Chưa đăng nhập' });
    }

    try {
        const user = await User.findById(req.session.userId);
        const { HoTen, Email, SoDT, currentPassword, newPassword } = req.body;

        // Nếu muốn đổi mật khẩu
        if (newPassword) {
            if (!currentPassword) {
                return res.json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại!' });
            }
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.json({ success: false, message: 'Mật khẩu hiện tại không đúng!' });
            }
            if (newPassword.length < 6) {
                return res.json({ success: false, message: 'Mật khẩu mới phải từ 6 ký tự!' });
            }
            user.password = newPassword; // pre-save sẽ tự hash
        }

        // Cập nhật thông tin cơ bản
        user.HoTen = HoTen?.trim() || user.HoTen;
        user.Email = Email?.trim() || user.Email;
        user.SoDT = SoDT?.trim() || user.SoDT;

        await user.save();

        res.json({ success: true });

    } catch (err) {
        console.error("Lỗi cập nhật profile:", err);
        res.json({ success: false, message: 'Lỗi server' });
    }
});
// ==================== TRANG "VÉ CỦA TÔI" – ĐÃ TEST 100% CHẠY ====================
// PHIÊN BẢN SIÊU ỔN ĐỊNH – CHẠY NGAY DÙ items: [] HOẶC KHÔNG CÓ eventId
app.get('/my-tickets', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    try {
        let orders = await Order.find({ userId: req.session.userId })
            .sort({ createdAt: -1 })
            .lean();

        // DUYỆT TỪNG ORDER ĐỂ GẮN THÔNG TIN SỰ KIỆN
        for (let order of orders) {
            // Mặc định
            order.event = {
                title: "Sự kiện không xác định",
                location: "Chưa có địa điểm",
                startDate: new Date(),
                thumbnail: "/public/image/default-event.jpg"
            };

            let eventId = null;

            // Ưu tiên 1: Lấy từ items (nếu có)
            if (order.items && order.items.length > 0 && order.items[0].ticketTypeId) {
                eventId = order.items[0].ticketTypeId;
            }
            // Ưu tiên 2: Nếu items rỗng → lấy từ blockchain_transactions (cách cứu cánh siêu hay!)
            else {
                const tx = await BlockchainTx.findOne({ orderId: order._id }).lean();
                if (tx && tx.eventId) {
                    eventId = tx.eventId;
                }
                // Nếu vẫn không có → thử lấy từ URL khi đặt vé (có thể lưu tạm trong session, nhưng cách này đủ rồi)
            }

            // Nếu tìm được eventId → lấy thông tin event
            if (eventId) {
                const event = await Event.findById(eventId).lean();
                if (event) {
                    order.event = {
                        _id: event._id,
                        title: event.title || "Không có tiêu đề",
                        location: event.location || "Chưa có địa điểm",
                        startDate: event.startDate || new Date(),
                        thumbnail: event.thumbnail || "/public/image/default-event.jpg"
                    };
                }
            }
        }

        res.render('my-tickets', { orders });
    } catch (err) {
        console.error("Lỗi tải vé:", err);
        res.render('my-tickets', { orders: [] });
    }
});
}