const express = require('express');
const User = require('../users/user.model');
const Order = require('../orders/orders.model');
const Reviews = require('../reviews/reviews.model');
const Products = require('../products/products.model');
const router = express.Router();

router.get('/user-stats/:email', async (req, res) => {
    const { email } = req.params;

    // Validate email number
    if (!email) {
        return res.status(400).send({ message: 'email number is required' });
    }

    try {
        // Find the user by phone number
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }

        // Calculate total payments for completed orders
        const totalPaymentResults = await Order.aggregate([
            { 
                $match: { 
                    email: email, 
                    paymentStatus: "completed" // Filter by completed payments
                } 
            },
            { 
                $group: { 
                    _id: null, 
                    amount: { $sum: "$amount" } // Sum the amount for completed orders
                } 
            }
        ]);

        // Extract the total payment amount (default to 0 if no results)
        const totalPaymentAmount = totalPaymentResults.length > 0 ? totalPaymentResults[0].amount : 0;

        // Count total reviews by the user
        const totalReviews = await Reviews.countDocuments({ userId: user._id });

        // Get distinct product IDs from completed orders
        const totalPurchasedProducts = await Order.distinct("products.productId", { 
            email: email, 
            paymentStatus: "completed" // Filter by completed payments
        });

        // Send the response
        res.status(200).send({
            totalPayments: totalPaymentAmount.toFixed(2), // Format to 2 decimal places
            totalReviews,
            totalPurchasedProducts: totalPurchasedProducts.length // Return the count of distinct products
        });

    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).send({ message: 'Failed to fetch user stats' });
    }
});

router.get('/admin-stats', async (req,res) => {
    try {
        const totalOrders = await Order.countDocuments();
        const totalProducts = await Products.countDocuments();
        const totalUsers = await User.countDocuments();
        const totalReviews = await Reviews.countDocuments();

        const totalEarningsResult = await Order.aggregate([
            {
                $group:{
                    _id: null,
                    totalEarnings: {$sum: "$amount"}
                }
            }
        ])

        const totalEarnings = totalEarningsResult.length > 0 ? totalEarningsResult[0].
        totalEarnings : 0;

        const monthlyEarningResults = await Order.aggregate([
            {
                $group:{
                    _id: {month: {$month: "$createdAt"}, year: {$year: "$createdAt"}},
                    monthlyEarnings : {$sum: "$amount"}

                }
            },
            {
                $sort: {"_id.year": 1, "_id.month": 1}
            }
        ])

        const monthlyEarnings = monthlyEarningResults.map((entry) =>({
            month: entry._id.month,
            year: entry._id.year,
            earnings: entry.monthlyEarnings.toFixed(2)
        }))
        res.status(200).json({
            totalOrders,
            totalProducts,
            totalUsers,
            totalReviews,
            totalEarnings,
            monthlyEarnings
        })

    } catch (error) {
        console.error("Error fetching admin stats", error);
        res.status(500).send({message: 'Failed to fetch admin stats'})
        
    }
})

module.exports = router;