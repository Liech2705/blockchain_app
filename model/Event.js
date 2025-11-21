const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    title: String,
    description: String,
    location: String,
    thumbnail: String,
    images: [String],
    startDate: Date,
    endDate: Date,
    category: String,
    status: { type: String, default: "public" },
    // Ticket Type fields (merged from separate TicketType collection)
    type_name: { type: String, default: "General" },
    quantity_total: { type: Number, default: 0 },
    quantity_sold: { type: Number, default: 0 },
    ticket_status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Event", eventSchema);
