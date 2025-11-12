const mongoose=require('mongoose');
const Schema=mongoose.Schema;

const admin=new Schema({
    name:String,
    email:String,
    password:String,
})

const Admin=mongoose.model('Admin',admin);
module.exports=Admin