const express = require('express');
const cors= require('cors');
require('dotenv').config();
const app = express();
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion } = require('mongodb');
const port =process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});



const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

     const db = client.db("ticket-booking-platform");
     const ticketsCollection = db.collection("tickets");

    

    app.get('/api/tickets', async (req,res)=>{
         const query={};
         if(req.query.vendorId){
          query.vendorId=req.query.vendorId
         }
        const result= await ticketsCollection.find(query).toArray();
        res.json(result);
    }) 
    app.post('/api/tickets', async(req,res)=>{
      console.log("REQ BODY:", req.body);
      const ticket= req.body;
      const newTicket={
        ...ticket,
        verificationStatus:"pending",
        isAdvertised: false,
        createdAt: new Date()
      }
      const result= await ticketsCollection.insertOne(newTicket);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});