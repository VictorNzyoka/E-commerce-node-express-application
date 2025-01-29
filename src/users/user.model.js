const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const bcrypt = require('bcrypt');


const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    profileImage: { type: String },
    bio: { type: String, maxlength: 200 },
    profession: { type: String },
    phone: { 
        type: String, 
        required: true, 
        unique: true, 
        match: [/^\+?(\d[\d- ]{7,15})$/, 'Please enter a valid phone number'] 
      },       

   createdAt:{
        type: Date,
        default: Date.now,
  },
  updatedAt:{
    type: Date,
},
}
);

//Hashing password
userSchema.pre('save', async function(next){
  const user = this;
  if(!user.isModified('password')) return next;
  const  hashedPassword = await bcrypt.hash(user.password, 10);
  user.password = hashedPassword;
  next();
})

//match password
userSchema.methods.comparePassword = function (Password){
  return bcrypt.compare(Password,this.password)
}

const User = new model('User', userSchema);

module.exports = User;
