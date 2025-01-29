const express = require('express')
const User = require('./user.model');
const generateToken = require('../../middleware/generateToken');
const verifyToken = require('../../middleware/verifyToken');
const router = express.Router();

router.get("/", async (req,res) =>{
    res.send("hello")
})
router.post("/register", async ( req,res) =>
{
    try{
        const {username,email,password,phone} = req.body;
        const user = new User({email,username,password,phone});
        await user.save()
        res.status(201).send({message: "User registered successfully", user})

    }catch(error){
        console.error("Error registering user",error);
        res.status(500).send({message: "Error registering user",})

    }
})


//Login
router.post('/login', async (req,res) => {
    try{
        const{email,password} = req.body;
        const user = await User.findOne({email});
        if(!user){
            return res.status(404).send({message: 'User not found'})
        }
        const isMatch = await user.comparePassword(password);
        if(!isMatch){
            return res.status(401).send({message: 'Password not matched'})
        }
        const token = await generateToken(user._id)
        // console.log(token)
        res.cookie('token',token,{
            httpOnly: true,
            secure: true,
            sameSite: 'None'
        })

        res.status(200).send({message: 'Logged in successfull',token, user:{
            _id: user._id,
            email: user.email,
            username: user.username,
            role: user.role,
            phone: user.phone,
            profileImage: user.profileImage,
            bio: user.bio,
            profession: user.profession,
        }})

    }catch (error){

        console.error("Error Logging user",error);
        res.status(500).send({message: "Error logging user",})

    }
})

// router.get("/users", verifyToken, async (req,res) => {
//     res.send({message: "protected"})
// })

//logout
router.post('/logout', (req,res) => {
    res.clearCookie('token');
    res.status(200).send({message: 'Logged out successfully'});
})

router.delete('/user/:id', async(req,res) => {
    try{
        const {id} = req.params;
        const user = await User.findByIdAndDelete(id);
        if(!user){
            return res.status(404).send({message: 'User not found'})
        }
        res.status(200).send({message: 'User deleted successfully'})
    }catch(error){

        console.error("Error Deleting user",error);
        res.status(500).send({message: "Error deleting user",})
    }
})

router.get('/users', async (req,res) => {
    try{
        const users = await User.find({}, 'id email role').sort({createdAt: -1});
        res.status(200).send(users);

    }catch(error){

        console.error("Error fetching users",error);
        res.status(500).send({message: "Error fetching users",})
    }
})

//update user role
router.put('/users/:id', async (req,res) =>{
    try{
        const {id} = req.params;
        const {role} = req.body;
        const user = await User.findByIdAndUpdate(id, {role}, {new: true});
        if(!user){
            return res.status(404).send({message: 'User not found'})
        }
        res.status(200).send({message: 'User role updated successfully', user})
    }
    catch(error){

        console.error("Error updating user role",error);
        res.status(500).send({message: "Error updating user role",});
    }
})

//update profile
router.patch('/edit-profile', async (req,res) => {
    try {
        const {userId,username,phone,profileImage,bio,profession} = req.body;
        if(!userId){
            return res.return(400).send({message: 'User ID is required'})
        }
        const user = await User.findById(userId);

        if(!user){
            return res.return(400).send({message: 'User not found'})
        }
        // console.log(user)
        if(username !== undefined) user.username = username;
        if(phone !== undefined) user.phone = phone;
        if(profileImage !== undefined) user.profileImage = profileImage;
        if(bio !== undefined) user.bio = bio;
        if(profession !== undefined) user.profession = profession;

        await user.save();
        res.status(200).send({
            message: 'User updated successfully',
            user: { 
                _id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                phone: user.phone,
                profileImage: user.profileImage,
                bio: user.bio,
                profession: user.profession,
            }, 
        });
        
    } catch (error) {
        console.error("Error updating profile",error);
        res.status(500).send({message: "Error updating profile",});
        
    }
})

module.exports = router;