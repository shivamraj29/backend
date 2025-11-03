import dotenv from "dotenv";
import mongoose from "mongoose";
import {DB_NAME} from "../constants.js";

dotenv.config({
    path: './env'
})

const connctDB = async () => {
    try{
        const connctionInstance = await mongoose.connect
        (`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`Connection success, ${connctionInstance}`)
    }
    catch(error){
        console.log("MongoDB server error", error)
        process.exit(1)
    }
}

export default connctDB