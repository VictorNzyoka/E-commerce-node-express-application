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
    const { phoneNumber, amount, products,userId,email } = req.body;
    // console.log(req.body)
  

    // Validate required fields
    if (!phoneNumber || !amount || !products || !userId || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }

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

    // console.log(finalPhone)

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
      CallBackURL: "https://6c84-197-232-62-193.ngrok-free.app/api/orders/callback",
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
      const checkoutRequestId = response.data.CheckoutRequestID;

      //Save Order with CheckoutRequestID as orderId
      const newOrder = new Order({
        orderId: checkoutRequestId,
        userId,
        email,
        phone: finalPhone,
        products,
        amount
      });

      await newOrder.save();

      return res.status(200).json({
        success: true,
        message: "STK push sent successfully, order saved",
        data: response.data,
        order: newOrder
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


router.post("/callback", async (req, res) => {
  try {
    const callbackData = req.body;
    const stkCallback = callbackData?.Body?.stkCallback;

    // Log the stkCallback object for debugging
    // console.log("stkCallback:", stkCallback);

    //Check if payment failed (no metadata or ResultCode !== 0 means payment failed or was cancelled)
    if (stkCallback.ResultCode !== 0 || !stkCallback.CallbackMetadata) {
      // console.log("User cancelled transaction or payment failed");

      //Update order as "failed"
      await Order.findOneAndUpdate(
        { orderId: stkCallback.CheckoutRequestID },
        { paymentStatus: "failed" },
        { new: true }
      );

      return res.status(200).json({
        success: false,
        message: "Payment failed or user cancelled",
      });
    }

    // console.log("Successful Payment Callback");

    //Extract callback metadata
    const checkoutRequestId = stkCallback?.CheckoutRequestID;
    const metadata = stkCallback?.CallbackMetadata?.Item || [];

    //Extract phone number and amount from metadata
    const phoneMetadata = metadata.find(item => item.Name === "PhoneNumber")?.Value;
    const amountMetadata = metadata.find(item => item.Name === "Amount")?.Value;

    if (!checkoutRequestId || !phoneMetadata || !amountMetadata) {
      console.log("Missing required metadata");
      return res.status(400).json({ success: false, message: "Missing required metadata" });
    }

    //Find the order in the database
    const order = await Order.findOne({ orderId: checkoutRequestId });

    if (!order) {
      console.log("Order not found");
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Ensure phone number and amount match the order
    if (order.phone !== String(phoneMetadata) || order.amount !== amountMetadata) {
      console.log("Phone or amount mismatch, possible fraud attempt");
      return res.status(400).json({
        success: false,
        message: "Phone number or amount does not match order details",
      });
    }

    // Update order as successful
    await Order.findOneAndUpdate(
      { orderId: checkoutRequestId },
      { paymentStatus: "completed" },
      { new: true }
    );

    console.log("Payment successful, order updated");
    res.status(200).json({
      success: true,
      message: "Payment successful, order updated",
    });

  } catch (error) {
    console.error("Callback Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Callback processing failed",
      error: error.message
    });
  }
});

  
  router.get("/:email", async (req, res) => {
    // console.log('Received request for orders. Query:', req.query);
    try {
      const { email }  = req.params;
      // console.log(email)
  
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

  router.get("/", async (req, res) => {
    try {
      // Pagination
      const page = parseInt(req.query.page) || 1; 
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      //Sorting (default: sort by createdAt in descending order)
      const sort = req.query.sort || "-createdAt";
  
      //Filtering (optional)
      const filter = {};
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.paymentStatus) {
        filter.paymentStatus = req.query.paymentStatus;
      }
  
      //Fetch orders with pagination, sorting, and filtering
      const orders = await Order.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);
  
      //Get total number of orders (for pagination metadata)
      const totalOrders = await Order.countDocuments(filter);
  
      //Send response with metadata
      const meta = {
        totalOrders,
        currentPage: page,
        ordersPerPage: limit,
        totalPages: Math.ceil(totalOrders / limit),
      };
  
      res.status(200).send({
        success: true,
        message: "Orders fetched successfully",
        data: orders,
        meta,
      });
  
      // console.log(orders, meta); 
  
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).send({
        success: false,
        message: "Error fetching orders",
        error: error.message,
      });
    }
  });
  
  router.patch('/update-order-status/:id', async (req, res) => {
    const { id } = req.params; 
    const { status } = req.body;
  
    // console.log("Received ID:", id);
    // console.log("Received Status:", status); 
  
    if (!status) {
      return res.status(400).send({ message: "Status is required" });
    }
  
    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        { status, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).send({ message: "Order not found" });
      }
  
      res.status(200).json({
        message: "Status updated successfully",
        order: updatedOrder,
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).send({ message: "Error updating order status", error: error.message });
    }
  });
  router.delete("/delete-order/:id", async(req,res) => {
    const {id} = req.params;
    // console.log(id)
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
  
