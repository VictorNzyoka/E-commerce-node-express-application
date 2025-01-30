const express = require('express');
const router = express.Router();
const Order = require('./orders.model');
const { initiateSTKPush } = require('../services/mpesa');

// 📌 Route: Checkout and Initiate Payment
router.post("/checkout", async (req, res) => {
    const { products, email, phone, amount } = req.body;
  
    if (!products || !phone || !amount || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }
  
    try {
      // Create an order entry
      const order = new Order({
        orderId: uuidv4(),
        products,
        amount,
        email,
        phone,
        status: "pending",
      });
  
      await order.save();
  
      // Initiate M-Pesa Payment
      const paymentResponse = await initiateSTKPush(phone, amount, order._id);
  
      if (paymentResponse.ResponseCode === "0") {
        res.status(200).json({
          message: "Payment request sent. Complete the payment on your phone.",
          checkoutRequestID: paymentResponse.CheckoutRequestID,
          merchantRequestID: paymentResponse.MerchantRequestID,
          orderId: order._id, // Send order ID for reference
        });
      } else {
        res.status(400).json({
          message: "M-Pesa payment request failed",
          response: paymentResponse,
        });
      }
    } catch (error) {
      console.error("Error processing checkout:", error);
      res.status(500).json({ message: "Failed to process checkout" });
    }
  });
  
  // 📌 Route: M-Pesa Payment Callback
  router.post("/callback", async (req, res) => {
    console.log("M-Pesa Callback Received:", req.body);
  
    const { Body } = req.body;
  
    if (!Body || !Body.stkCallback) {
      return res.status(400).json({ message: "Invalid callback data" });
    }
  
    const { MerchantRequestID, CheckoutRequestID, ResultCode, CallbackMetadata } =
      Body.stkCallback;
  
    if (ResultCode === 0) {
      // Payment successful
      const mpesaReceipt = CallbackMetadata.Item.find(
        (item) => item.Name === "MpesaReceiptNumber"
      )?.Value;
  
      const phoneNumber = CallbackMetadata.Item.find(
        (item) => item.Name === "PhoneNumber"
      )?.Value;
  
      try {
        // Update order status in database
        const order = await Order.findOne({ phone: phoneNumber });
  
        if (order) {
          order.status = "completed";
          await order.save();
  
          console.log(`Order ${order._id} completed with M-Pesa receipt: ${mpesaReceipt}`);
          res.status(200).json({ message: "Payment successful", orderId: order._id });
        } else {
          res.status(404).json({ message: "Order not found" });
        }
      } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ message: "Error updating order status" });
      }
    } else {
      // Payment failed
      console.error(`M-Pesa payment failed for CheckoutRequestID: ${CheckoutRequestID}`);
      res.status(400).json({ message: "M-Pesa payment failed" });
    }
  });
  
  module.exports = router;
  
