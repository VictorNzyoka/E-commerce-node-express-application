const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret:process.env.API_SECRET
});
const options = {
    overwrite : true,
    resource_type: "auto",
    invalidate: true
}
module.exports = (image) => {
    return new Promise((resolve,reject) => {
        cloudinary.uploader.upload(image,options,(err,result) => {
            if(result && result.secure_url){
                return resolve(result.secure_url)
            }return reject({message:"Error uploading image",err})
        })
    })

    
}