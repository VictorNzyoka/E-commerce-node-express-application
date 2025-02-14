const express = require('express');
const router = express.Router();
const Order = require('./orders.model');
const { initiateSTKPush } = require('../services/mpesa');
const verifyToken = require('../../middleware/verifyToken');
const verifyAdmin = require('../../middleware/verifyAdmin');

// 📌 Route: Checkout and Initiate Payment
router.post("/checkout", async (req, res) => {
    const { products, email, phone, amount } = req.body;
  
    if (!products || !phone || !amount || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }
  
    try {
      // Create an order entry
      const order = new Order({
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
          orderId: order._id, 
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
  
  
  router.get("/:email", async (req, res) => {
    console.log('Received request for orders. Query:', req.query);
    try {
      const email  = req.params.email;
  
      if (!email) {
        // console.log('No email provided in the request');
        return res.status(400).send({ message: "Email is required" });
      }
  
      // console.log('Searching for orders with email:', email);
      const orders = await Order.find({ email })
        // .sort({ createdAt: -1 })
        // .select('-__v');
  
      // console.log('Orders found:', orders.length);
  
      if (orders.length === 0 || !orders) {
        // console.log('No orders found for email:', email);
        return res.status(400).send({ orders: 0, message: "No orders found for this email" });
      }
  
      // console.log('Sending orders response');
      res.status(200).send(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).send({ message: "Error fetching orders", error: error.message });
    }
  });

  router.get("/order/:id", async(req,res) =>{
    try {
      const order = await Order.findByIdAndUpdate(req.params.id);
      if(!order){
        return res.status(404).send({message:"Orders not found"})
      }
      res.status(200).send(order);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).send({ message: "Error fetching orders", error: error.message });
      
    }
  }
  )

  router.get("/",async(req,res) =>{
    try {
      const orders = await Order.find().sort({createdAt: -1})
      if(!orders){
        return res.status(404).send({message: "No orders found"})
      }
      res.status(200).send(orders)
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).send({ message: "Error fetching orders", error: error.message });
      
    }
  })
  router.patch('/update-order-status/:id',async (req,res) =>{
    const {id} =req.params;
    const{status} = req.body;
    if(!status){
      return res.status(400).send({message: "Status is required"})
    }
    try {
      const updatedOrder = await Order.findByIdAndUpdate(id, {
        status,
        updatedAt: new Date()
      },{
        bew: true, runValidators: true
      }
    );
    if(!updatedOrder){
      return res.status(404).send({message: "Order not found"})
    }
    res.status(200).json({
      message: "Stus updated successfully",
      order: updatedOrder
    })
    } catch (error) {
      console.error('Error fetching orders status:', error);
      res.status(500).send({ message: "Error fetching orders status", error: error.message });
      
    }
  })
  router.delete("/delete-order/id", async(req,res) => {
    const {id} = req.params;
    try {
      const deletedOrder = await Order.findByIdAndDelete(id);
      if(!deletedOrder){
        return res.status(404).send({message: "Order not found"})
      }
      res.status(200).json({
        message: "Order deleted successfully",
        order: deletedOrder
      })
    } catch (error) {
      console.error('Error deleting orders:', error);
      res.status(500).send({ message: "Error deleting orders", error: error.message });
      
    }
  })
  module.exports = router;
  
