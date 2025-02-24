const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  orderId: String,
  userId: { type: String, required: true },
  phone: { type: String, required: true },
  products: [
    {
      productId: { type: String, required: true },
      quantity: { type: Number, required: true },
    }
  ],
  amount: Number,
  email: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "completed"],
    default: "pending"
  }
}, { timestamps: true });

const Order = mongoose.model("Order", OrderSchema);
