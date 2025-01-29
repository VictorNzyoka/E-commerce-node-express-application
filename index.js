const express = require('express');
const mongoose = require('mongoose');
const app = express();
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const port = process.env.PORT || 5000;

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

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);

main().then(() => console.log("mongodb connected successfully")). catch(err => console.log(err));

async function main() {
    await mongoose.connect(process.env.DB_URL);
     
     app.get('/', (req, res) => {
        res.send('Hello World!');
      });
      
}


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
