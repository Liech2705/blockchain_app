const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    Email: String,
    HoTen: String,
    SoDT: String,
    password: String,
    walletAddress: String,
    ThanhToan: { type: Boolean, default: false },
    Vi: String,
    role: { type: String, default: "user" },
    status: { type: String, default: "active" },
    Ngay: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("user", userSchema);