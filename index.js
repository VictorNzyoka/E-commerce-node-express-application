const express = require('express');
const mongoose = require('mongoose');
const app = express();
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const port = process.env.PORT || 5000;
const ngrok = require('@ngrok/ngrok');

app.use(express.json({limit: "25mb"}));
// app.use((express.urlencoded({limit: "25mb"})));
app.use(cookieParser());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}))


//All routes
const authRoutes = require('./src/users/user.route');
const productRoutes = require('./src/products/product.route');
const reviewRoutes = require('./src/reviews/reviews.route');
const checkoutRoutes = require('./src/orders/orders.route');
const statsRoutes = require('./src/stats/stats.route');

//Image upload
const uploadImage = require('./src/utils/uploadImage')

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', checkoutRoutes);
app.use('/api/stats', statsRoutes);

main().then(() => console.log("mongodb connected successfully")). catch(err => console.log(err));

async function main() {
    await mongoose.connect(process.env.DB_URL);
     
     app.get('/', (req, res) => {
        res.send('Hello World!');
      });
      
}
app.post("/uploadImage", (req,res) => {
  uploadImage(req.body.image).then((url) => res.send(url)).catch((err) => res.status(500).send(err));
})


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// ngrok.connect({ 
//   addr: 8080, 
//   authtoken: process.env.AUTH_TOKEN  
// })
// .then(listener => console.log(`Ingress established at: ${listener.url()}`))
// .catch(err => console.error("Ngrok error:", err));


