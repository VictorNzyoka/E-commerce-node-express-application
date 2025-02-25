const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, sparse: true },
  userId: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  products: [
    {
      productId: { type: String, required: true },
      quantity: { type: Number, required: true },
    }
  ], 
  amount: Number,
  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "completed"],
    default: "pending"
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending"
  }
}, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);
