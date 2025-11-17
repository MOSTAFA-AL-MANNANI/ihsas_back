const mongoose=require('mongoose');
const Schema=mongoose.Schema;

const center=new Schema({
    name:String,
    description:String,
    address:String,
    phone:String,
})

const Center=mongoose.model('Center',center);
module.exports=Center