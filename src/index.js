import dotenv from "dotenv";
import connctDB from "./db/index.js";
import { app } from "./app.js";


dotenv.config({
    path: './env'
})

connctDB().
then(()=> {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server running ${process.env.PORT}`)
    })
}
).
catch((err) => console.log("MongoDB connection failed" , err)
)