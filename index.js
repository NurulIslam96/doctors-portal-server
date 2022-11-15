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

//DB Collections
const appointmentCollection = client.db("dbDoctorPortal").collection("appointments");
const bookingCollection = client.db("dbDoctorPortal").collection("bookings")

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

//Get Appointment Collection
app.get("/appointments", async(req,res)=>{
    const date = req.query.date;
    const allAppointments = await appointmentCollection.find({}).toArray();
    const bookingQuery = {appointmentDate: date}
    const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
    allAppointments.forEach(appointment => {
        const optionsBooked =  alreadyBooked.filter(book => book.treatment === appointment.name)
        const bookedSlots = optionsBooked.map(book => book.slot)
        const remainingSlots = appointment.slots.filter(slot => !bookedSlots.includes(slot))
        appointment.slots = remainingSlots
    })
    res.send(allAppointments)
})

//Book Appointments
app.post("/bookings", async(req,res)=>{
    const query = {
        appointmentDate : req.body.appointmentDate,
        email: req.body.email,
        treatment: req.body.treatment
    }
    const alreadyBooked = await bookingCollection.find(query).toArray();
    if(alreadyBooked.length){
        const message = `You already have an appointment on ${req.body.appointmentDate}`
        return res.send({
            acknowledge: false,
            message
        })
    }
    const result = await bookingCollection.insertOne(req.body)
    res.send(result)
})

//Get my Appointments
app.get("/myAppointment", async(req,res)=>{
    const result = await bookingCollection.find({email: req.query.email}).toArray()
    res.send(result)
})

//DB Connection Status
app.get('/', (req,res)=>{
    res.send("API is Connected");
})
app.listen(port , ()=>{
    console.log("Server is running through PORT: ", port);
})