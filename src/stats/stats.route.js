const express = require('express');
const User = require('../users/user.model');
const Order = require('../orders/orders.model');
const Reviews = require('../reviews/reviews.model');
const Products = require('../products/products.model');
const router = express.Router();

router.get('/user-stats/:email', async(req,res) =>{
    const {email} = req.params;
    console.log(email)
    if(!email){
        return res.status(400).send({message: 'Email is required'});
    }
    try {
        const user = await User.findOne({email: email})
        // console.log(user)
        if(!user){
            return res.status(404).send({message: "User not found"});
        }

        const totalPaymentResults = await Order.aggregate([
            {$match: {email: email}},
            {
                $group: {_id: null,totalAmount: {$sum: "$amount"}}
            }
        ])

        const totalPaymentAmount = totalPaymentResults.length > 0 ? totalPaymentResults[0].
        totalAmount: 0

        const totalReviews = await Reviews.countDocuments({userId: user._id})

        const totalPurchasedProducts = await Order.distinct("Products.productId",{email: email});

        res.status(200).send({
            totalPayments: totalPaymentAmount.toFixed(2),
            totalReviews,
            totalPurchasedProducts
            
        })

        
    } catch (error) {
        console.error("Error fetching user stats", error);
        res.status(500).send({message: 'Failed to fetch user stats'})
        
    }
})

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