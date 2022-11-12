const express = require('express');
const cors = require('cors');
const colors = require('colors');
const { MongoClient } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

//MiddleWare
app.use(cors())
app.use(express.json())

const uri = "mongodb://127.0.0.1:27017/";
const client = new MongoClient(uri);

//DB connect
async function dbconnect (){
    try {
        await client.connect()
        console.log("Database is Connected".bgBlue)
    } catch (error) {
        console.log(error.message.bgRed);
    }
}

dbconnect()

//DB Connection Status
app.get('/', (req,res)=>{
    res.send("API is Connected");
})
app.listen(port , ()=>{
    console.log("Server is running through PORT: ", port);
})