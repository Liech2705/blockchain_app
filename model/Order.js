const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    items: [{
        ticketTypeId: mongoose.Schema.Types.ObjectId,
        quantity: Number,
        price: Number
    }],
    totalAmount: Number,
    paymentMethod: String,
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("order", orderSchema);
