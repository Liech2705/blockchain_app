var User = require("../model/User");
var Event = null;

module.exports = function (app) {

    // lazy-require Event so models are available after mongoose connects
    try { Event = require('../model/Event'); } catch (e) { /* ignore */ }

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
    const Order = require("../model/Order");
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
}