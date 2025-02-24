const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true }, // Link to Order
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Link to User
    phone: { type: String, required: true }, // M-Pesa Phone Number
    amount: { type: Number, required: true },
    transaction_id: { type: String, unique: true }, // From IntaSend
    status: { type: String, enum: ["Pending", "Completed", "Failed"], default: "Pending" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Payment", PaymentSchema);
