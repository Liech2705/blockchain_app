const mongoose = require("mongoose");

const checkinSchema = new mongoose.Schema({
    ticketId: mongoose.Schema.Types.ObjectId,
    eventId: mongoose.Schema.Types.ObjectId,
    scanTime: { type: Date, default: Date.now },
    scanner: String
});

module.exports = mongoose.model("checkin_log", checkinSchema);
