const mongoose=require('mongoose');
const Schema=mongoose.Schema;

const filiere=new Schema({
    name:String,
    description:String,
      center: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Center",
        required: true
      },
})

const Filiere=mongoose.model('Filiere',filiere);
module.exports=Filiere