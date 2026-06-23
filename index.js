const express = require('express');
const cors= require('cors');
require('dotenv').config();
const app = express();
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
         if(req.query.verificationStatus){
          query.verificationStatus=req.query.verificationStatus;
         }
         if(req.query.from){
          query.from={
            $regex:req.query.from, $options:"i"
          }
         }
         if(req.query.to){
          query.to={
            $regex:req.query.to, $options:"i"
          }
         }
         if(req.query.transportType){
          query.transportType=req.query.transportType;
         }
         const sorting={};
         if(req.query.sort==="low"){
          sorting.price=1;
         }
         if(req.query.sort==="high"){
          sorting.price=-1;
         }
        const result= await ticketsCollection.find(query).sort(sorting).toArray();
        res.json(result);
    }) 

    app.get('/api/tickets/:id',async (req,res)=>{
      const id = req.params.id;
      const result = await ticketsCollection.findOne({_id:new ObjectId(id)})
      res.send(result)
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
    app.patch('/api/tickets/:id',async(req,res)=>{
      const id= req.params.id;
      const updateTicket=req.body;
      console.log(updateTicket)
      const filter={_id: new ObjectId(id)}
      const updatedDoc={
        $set:updateTicket
      }
      const result= await ticketsCollection.updateOne(filter,updatedDoc)
      res.send(result)
    })
      
    app.delete('/api/tickets/:id', async(req,res)=>{
      const id= req.params.id;
      const query={
        _id: new ObjectId(id)
      }
      const result= await ticketsCollection.deleteOne(query);
      res.send(result)
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