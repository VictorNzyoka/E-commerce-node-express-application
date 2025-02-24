const express = require('express');
const router = express.Router();
const axios = require("axios");
const Order = require('./orders.model');
const Payment = require('./order.payment');


// Generate M-Pesa access token middleware
const generateToken = async (req, res, next) => {
  try {
    const consumer = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;

    if (!consumer || !secret) {
      throw new Error("Consumer key or secret key is missing");
    }

    const auth = Buffer.from(`${consumer}:${secret}`).toString("base64");

    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          authorization: `Basic ${auth}`,
        },
      }
    );

    req.token = response.data.access_token;
    // console.log(req.token)
    next();
  } catch (error) {
    console.error("Token Generation Error:", error);
    if (res && res.status) {
      return res.status(500).json({ success: false, message: "Failed to generate access token" });
    } else {
      console.error("Response object is undefined");
    }
  }
};
router.get("/test", async (req, res) => {
  // Mock req and res objects
  const mockReq = {
    env: process.env,
    token: null,
  };
  const mockRes = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log(data);
      return this;
    }
  };

  // Call generateToken with mockReq, mockRes, and a mock next function
  generateToken(mockReq, mockRes, () => {
    console.log("Token generated successfully:", mockReq.token);
  }).catch(error => {
    console.error("Error generating token:", error);
  });
});

router.post("/checkout", generateToken, async (req, res) => {
  try {
    const { phoneNumber, amount, products } = req.body;
  

    // Validate required fields
    // if (!phoneNumber || !amount || !products?.length) {
    //   return res.status(400).json({ 
    //     success: false, 
    //     message: "Missing required fields" 
    //   });
    // }

    // Generate timestamp
    const date = new Date();
    const timestamp = 
      date.getFullYear() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);

    // Get shortcode and passkey from env
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;

    // Generate password
    const password = new Buffer.from(shortcode + passkey + timestamp).toString("base64");

   
    const finalPhone = `254${String(phoneNumber).slice(-9)}`;
    console.log(finalPhone)

    // Prepare STK push request
    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: finalPhone,
      PartyB: shortcode,
      PhoneNumber: finalPhone,
      CallBackURL: "https://mydomain.com/path",
      AccountReference: finalPhone,
      TransactionDesc: "test"
    };

    // Send STK push request
    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${req.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Handle successful response
    if (response.data.ResponseCode === "0") {
      res.status(200).json({
        success: true,
        message: "STK push sent successfully",
        data: response.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: "STK push failed",
        data: response.data
      });
    }

  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error);
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
      error: error.response?.data || error.message
    });
  }
});


  
// 📌 Route: M-Pesa Payment Callback
router.post("/callback", async (req, res) => {
  try {
      console.log("M-Pesa Callback Received:", req.body);

      const { transaction_id, status } = req.body;

      // Step 1: Find the Payment
      const payment = await Payment.findOneAndUpdate(
          { transaction_id },
          { status },
          { new: true }
      );

      if (payment) {
          // Step 2: Update Order Status
          await Order.findByIdAndUpdate(payment.order, { status: status === "Completed" ? "Processing" : "Pending" });

          console.log("Payment updated:", payment);
          res.status(200).json({ success: true, message: "Callback processed", payment });
      } else {
          console.log("Payment not found for transaction_id:", transaction_id);
          res.status(404).json({ success: false, message: "Payment not found" });
      }
  } catch (error) {
      console.error("Callback Error:", error.message);
      res.status(500).json({ success: false, message: "Callback processing failed" });
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

  router.get("/orders",async(req,res) =>{
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
  
