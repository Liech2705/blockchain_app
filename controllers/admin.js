const User = require('../model/User');
const Event = require('../model/Event');

const isAdmin = (req, res, next) => {
    if (req.session.userId && req.session.role === 'admin') {
        return next();
    }
    res.redirect('/login');
};

module.exports = function (app) {
    app.get('/login', (req, res) => {
        res.render('dangnhap');
    });

    app.post('/login', async (req, res) => {
        const { email, password } = req.body;
        const user = await User.findOne({ Email: email });
        if (!user) {
            return res.redirect('/login');
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.redirect('/login');
        }
        req.session.userId = user._id;
        req.session.role = user.role;
        res.redirect('/admin/users');
    });

    app.get('/logout', (req, res) => {
        req.session.destroy();
        res.redirect('/login');
    });

    // User management
    app.get('/admin/users', isAdmin, async (req, res) => {
        const users = await User.find();
        res.render('admin/users', { users });
    });

    app.get('/admin/users/add', isAdmin, (req, res) => {
        res.render('admin/add-user');
    });

    app.post('/admin/users/add', isAdmin, async (req, res) => {
        const { Email, HoTen, SoDT, password, role, status } = req.body;
        const newUser = new User({ Email, HoTen, SoDT, password, role, status });
        await newUser.save();
        res.redirect('/admin/users');
    });

    app.get('/admin/users/edit/:id', isAdmin, async (req, res) => {
        const user = await User.findById(req.params.id);
        res.render('admin/edit-user', { user });
    });

    app.post('/admin/users/edit/:id', isAdmin, async (req, res) => {
        const { Email, HoTen, SoDT, role, status } = req.body;
        await User.findByIdAndUpdate(req.params.id, { Email, HoTen, SoDT, role, status });
        res.redirect('/admin/users');
    });

    app.get('/admin/users/delete/:id', isAdmin, async (req, res) => {
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/admin/users');
    });


    // Event management
    app.get('/admin/events', isAdmin, async (req, res) => {
        const events = await Event.find();
        res.render('admin/events', { events });
    });

    app.get('/admin/events/add', isAdmin, (req, res) => {
        res.render('admin/add-event');
    });

    app.post('/admin/events/add', isAdmin, async (req, res) => {
        const newEvent = new Event(req.body);
        await newEvent.save();
        res.redirect('/admin/events');
    });

    app.get('/admin/events/edit/:id', isAdmin, async (req, res) => {
        const event = await Event.findById(req.params.id);
        res.render('admin/edit-event', { event });
    });

    app.post('/admin/events/edit/:id', isAdmin, async (req, res) => {
        await Event.findByIdAndUpdate(req.params.id, req.body);
        res.redirect('/admin/events');
    });

    app.get('/admin/events/delete/:id', isAdmin, async (req, res) => {
        await Event.findByIdAndDelete(req.params.id);
        res.redirect('/admin/events');
    });
};
