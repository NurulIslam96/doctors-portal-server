const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const colors = require("colors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//MiddleWare
app.use(cors());
app.use(express.json());

const uri = "mongodb://127.0.0.1:27017/";
const client = new MongoClient(uri);

//Custom Middleware
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send("Unauthorized Access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

//DB Collections
const appointmentCollection = client
  .db("dbDoctorPortal")
  .collection("appointments");
const bookingCollection = client.db("dbDoctorPortal").collection("bookings");
const usersCollection = client.db("dbDoctorPortal").collection("users");
const doctorsCollection = client.db("dbDoctorPortal").collection("doctors");
const paymentsCollection = client.db("dbDoctorPortal").collection("payments");


//VerifyAdmin
const verifyAdmin = async (req, res, next) => {
  const query = { email: req.decoded.email };
  const user = await usersCollection.findOne(query);
  if (user.role !== "admin") {
    res.status(403).send({ message: "forbidden access" });
  }
  next();
};

//DB connect
async function dbconnect() {
  try {
    await client.connect();
    console.log("Database is Connected".bgBlue);
  } catch (error) {
    console.log(error.message.bgRed);
  }
}
dbconnect();

//Get Appointment Collection
app.get("/appointments", async (req, res) => {
  const date = req.query.date;
  const allAppointments = await appointmentCollection.find({}).toArray();
  const bookingQuery = { appointmentDate: date };
  const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
  allAppointments.forEach((appointment) => {
    const optionsBooked = alreadyBooked.filter(
      (book) => book.treatment === appointment.name
    );
    const bookedSlots = optionsBooked.map((book) => book.slot);
    const remainingSlots = appointment.slots.filter(
      (slot) => !bookedSlots.includes(slot)
    );
    appointment.slots = remainingSlots;
  });
  res.send(allAppointments);
});

//temporary Updates on Appointment Data
// app.get('/addPrice', async(req,res)=>{
//   const filter = {}
//   const options = {upsert: true}
//   const updatedDoc = {
//     $set: {
//       price: 99
//     }
//   }
//   const result = await appointmentCollection.updateMany(filter,updatedDoc,options)
//   res.send(result)
// })

//get appoint speciality
app.get("/specialty", async (req, res) => {
  const result = await bookingCollection
    .find({})
    .project({ treatment: 1 })
    .toArray();
  res.send(result);
});

//Book Appointments
app.post("/bookings", async (req, res) => {
  const query = {
    appointmentDate: req.body.appointmentDate,
    email: req.body.email,
    treatment: req.body.treatment,
  };
  const alreadyBooked = await bookingCollection.find(query).toArray();
  if (alreadyBooked.length) {
    const message = `You already have an appointment on ${req.body.appointmentDate}`;
    return res.send({
      acknowledge: false,
      message,
    });
  }
  const result = await bookingCollection.insertOne(req.body);
  res.send(result);
});

//Get my Appointments
app.get("/myAppointment",verifyJWT, async (req, res) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: "forbidden access" });
  }
  const result = await bookingCollection
    .find({ email: req.query.email })
    .toArray();
  res.send(result);
});

//Payment
app.get("/payment/:id", async (req, res) => {
  const result = await bookingCollection.findOne({
    _id: ObjectId(req.params.id),
  });
  res.send(result);
});

app.post("/create-payment-intent", async (req, res) => {
  const price = req.body.price;
  const amount = price * 100;
  const paymentIntent = await stripe.paymentIntents.create({
    currency: "usd",
    amount: amount,
    "payment_method_types": ["card"],
  });
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

//JWT
app.get("/jwt", async (req, res) => {
  const email = req.query.email;
  const user = await usersCollection.findOne({ email: email });
  if (user) {
    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
      expiresIn: "7d",
    });
    return res.send({ accessToken: token });
  }
  return res.status(403).send({
    accessToken: "",
  });
});

//Save userinfo
app.post("/users", async (req, res) => {
  const email = req.body.email;
  const alreadyUser = await usersCollection.findOne({ email: email });
  if (!alreadyUser) {
    const result = await usersCollection.insertOne(req.body);
    res.send(result);
  } else {
    res.send({ message: "Already an User" });
  }
});

//Get all users
app.get("/users", async (req, res) => {
  const result = await usersCollection.find({}).toArray();
  res.send(result);
});

//get admin
app.get("/users/admin/:email", async (req, res) => {
  const user = await usersCollection.findOne({ email: req.params.email });
  res.send({ isAdmin: user?.role === "admin" });
});

//Make Admin
app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
  const filter = { _id: ObjectId(req.params.id) };
  const options = { upsert: true };
  const updatedDoc = {
    $set: {
      role: "admin",
    },
  };
  const result = await usersCollection.updateOne(filter, updatedDoc, options);
  res.send(result);
});

//POST doctors collection
app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
  const result = await doctorsCollection.insertOne(req.body);
  res.send(result);
});

//Get doctors collection
app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
  const result = await doctorsCollection.find({}).toArray();
  res.send(result);
});

//delete specific doctor
app.delete("/doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
  const result = await doctorsCollection.deleteOne({
    _id: ObjectId(req.params.id),
  });
  res.send(result);
});

//Post Payment Option
app.post('/payment', async(req,res)=>{
  const result  = await paymentsCollection.insertOne(req.body)
  const filter = {_id: ObjectId(req.body.booking_id)}
  const updatedDoc = {
    $set: {
      paid: true,
      transactionId: req.body.transactionId
    }
  }
  const updatedResult = await bookingCollection.updateOne(filter, updatedDoc)
  res.send(result)
})

//DB Connection Status
app.get("/", (req, res) => {
  res.send("API is Connected");
});
app.listen(port, () => {
  console.log("Server is running through PORT: ", port);
});
