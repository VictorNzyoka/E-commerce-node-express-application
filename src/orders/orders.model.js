const mongoose = require('mongoose')
const orderSchema = new mongoose.Schema({
    orderId: String,
    products:[
        {
        productId: {type:String,required: true},
        quantity: {type: Number, required: true},
        }
    ],
    amount: Number,
    email:{type: String,required: true},
    phone: { 
        type: String, 
        required: true, 
        unique: true, 
        match: [/^\+?(\d[\d- ]{7,15})$/, 'Please enter a valid phone number'] 
      }, 
      status: {
        type: String,
        enum: ["pending", "processing", "shipped", "completed"],
        default: "pending"
      }
}, {timestamps: true});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;