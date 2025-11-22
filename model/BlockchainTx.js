const mongoose = require("mongoose");

const blockchainTxSchema = new mongoose.Schema({
    orderId: mongoose.Schema.Types.ObjectId,
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' }, // ← THÊM DÒNG NÀY!
    txHash: String,
    fromAddress: String,
    toAddress: String,
    network: String,
    amount: String,
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("blockchain_transaction", blockchainTxSchema);