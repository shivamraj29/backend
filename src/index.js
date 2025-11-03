import dotenv from "dotenv";
import connctDB from "./db/index.js";


dotenv.config({
    path: './env'
})



connctDB()