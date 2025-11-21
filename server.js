
var express = require("express");
var app = express();
const session = require('express-session');

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./views");

var server = require("http").Server(app);
var io = require("socket.io")(server);
server.listen(3000, () => {
  console.log("✅ Server listening on port http://localhost:3000");
});

var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
console.log("Server starting...");
app.use("/scripts", express.static("node_modules/web3/dist/"));

//Mongoose
const mongoose = require('mongoose');
(async () => {
  try {
    await mongoose.connect("mongodb+srv://buyticks:fiwwk5RplW4um9Yp@cluster0.uof7z92.mongodb.net/buyticks?retryWrites=true&w=majority");
    console.log("✅ Mongo connected successfully!");
    const User = require('./model/User');
    const Event = require('./model/Event');

    // Middleware to load common data for views
    app.use(async (req, res, next) => {
        try {
            // Make user info available in all templates
            if (req.session.userId) {
                res.locals.user = await User.findById(req.session.userId);
            } else {
                res.locals.user = null;
            }
            
            // Make categories available in all templates
            res.locals.categories = await Event.distinct('category');
            
            // For the main page, we load special and trending events.
            // For other pages, we can just pass empty arrays.
            if (req.path === '/') {
                 res.locals.specialEvents = await Event.find().sort({ rank: 1 }).limit(5).lean();
                 res.locals.trendingEvents = await Event.find().sort({ rank: 1 }).lean();
            } else {
                res.locals.specialEvents = [];
                res.locals.trendingEvents = [];
            }

            next();
        } catch (err) {
            console.error("Error in data loading middleware:", err);
            // If something goes wrong, we provide empty data to avoid crashing
            res.locals.user = null;
            res.locals.categories = [];
            res.locals.specialEvents = [];
            res.locals.trendingEvents = [];
            next();
        }
    });

    // Load controllers after connection
    require("./controllers/buyticks")(app);
    require("./controllers/admin")(app);
    console.log("✅ Controllers loaded successfully!");

    // Fallback route to catch unhandled requests (AFTER controllers are loaded)
    app.use((req, res) => {
      console.log("⚠️ Unhandled request to:", req.method, req.url);
      res.status(404).send("Route not found");
    });
  } catch (err) {
    console.log("❌ Mongo connected error! " + err);
    console.error("Full error:", err);
    process.exit(1);
  }
})();

