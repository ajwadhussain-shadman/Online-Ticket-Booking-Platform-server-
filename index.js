const express = require('express');
const cors= require('cors');
require('dotenv').config();
const app = express();
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
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

const JWKS=createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
const verifyToken= async(req,res,next)=>{
  const authHeader=req.headers.authorization;
  console.log(authHeader)
  if(!authHeader || !authHeader.startsWith("Bearer")){
    return res.status(401).json({message:'Unauthorized'});
  }
  const token=authHeader.split(" ")[1];
  if(!token) { return res.status(401).json({message:"Unauthorized"})}

  try{
    const {payload}= await jwtVerify(token,JWKS);
    console.log("paylaod",payload)
    req.user=payload;
    console.log("payload",payload)

    next();
  } catch(error){
    console.log("JWT  Error:", error);
    return res.status(401).json({message:"Forbidden"});
  }
}
const verifyVendor=async(req,res,next)=>{
  if ( req.user.role!=="vendor"){
     return res.status(401).json({message:"Forbidden"});
  }
  next()
}
const verifyAdmin=async(req,res,next)=>{
  if ( req.user.role!=="admin"){
     return res.status(401).json({message:"Forbidden"});
  }
  next()
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

     const db = client.db("ticket-booking-platform");
     const testDb=client.db("test");
     const ticketsCollection = db.collection("tickets");
    const bookingsCollection=db.collection("bookings");
    const paymentsCollection=db.collection("payments");
    const usersCollection=testDb.collection("user");

    app.get('/api/users', verifyToken,verifyAdmin, async (req,res)=>{
      const result= await usersCollection.find().toArray();
      res.send(result)
    })
    app.patch('/api/users/role/:id', verifyToken,verifyAdmin, async(req,res)=>{
         const {role}=req.body;
         const result= await usersCollection.updateOne({ _id: new ObjectId(req.params.id)},
          {
            $set:{role}
          }
        )
       res.send(result) 
    })
    app.patch('/api/users/fraud/:id',verifyToken,verifyAdmin,async (req,res)=>{
      const id=req.params.id;
      const vendor= await usersCollection.findOne({_id:new ObjectId(id),role:"vendor"})
      if(!vendor) {return res.status(404).send({message:"Vendor not found"})}
       const fraudResult= await usersCollection.updateOne({
        _id:new ObjectId(id)
       },
       {
        $set:{
          isFraud:true,
        }
       }
        
      ) 
      
    const verificationResult= await ticketsCollection.updateMany({
      vendorId: vendor._id.toString(),
    },
     {
      $set:{
        verificationStatus: "fraudF"
      }
     }
  )  
  res.send({
    fraudResult,
    verificationResult
  })

    })

    app.get('/api/tickets', async (req,res)=>{
      const {page=1,limit=9}=req.query;
       const skip=(Number(page)-1)*Number(limit);
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
         console.log("vendorId",req.query.vendorId);
         console.log("querey",query)
        const result= await ticketsCollection.find(query).sort(sorting).skip(skip).limit(Number(limit)).toArray();
        const totalData=await ticketsCollection.countDocuments(query);
        const totalPage=Math.ceil(totalData/Number(limit))

        res.send({data:result,page:Number(page),totalPage});
    }) 

    app.get('/api/admin/tickets',verifyToken,verifyAdmin, async(req,res)=>{
       const result= await ticketsCollection.find().sort({createdAt:-1}).toArray();
       res.send(result);
    })
    app.get("/api/approved/tickets",async(req,res)=>{
      const result= await ticketsCollection.find({verificationStatus:'approved'}).toArray();
       res.send(result);
    })

    app.get('/api/tickets/:id',verifyToken, async (req,res)=>{
      const id = req.params.id;
      const result = await ticketsCollection.findOne({_id:new ObjectId(id)})
      res.send(result)
    })
    app.post('/api/tickets', async(req,res)=>{
      console.log("REQ BODY:", req.body);
      const ticket= req.body;
      const vendor=await usersCollection.findOne(
        {_id:new ObjectId(ticket.vendorId)}
      )

      if(vendor.isFraud){
        return res.status(403).send({message:"Fraud Vendor cannot add tickets."})
      }
      const newTicket={
        ...ticket,
        verificationStatus:"pending",
        isAdvertised: false,
        originalQuantity:ticket.quantity,
        createdAt: new Date()
      }
      const result= await ticketsCollection.insertOne(newTicket);
      res.send(result);
    })
    app.patch('/api/tickets/:id',verifyToken, async(req,res)=>{
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
    
      
    app.delete('/api/tickets/:id',verifyToken,verifyVendor, async(req,res)=>{
      const id= req.params.id;
      const query={
        _id: new ObjectId(id)
      }
      const result= await ticketsCollection.deleteOne(query);
      res.send(result)
    })
    
    app.get('/api/bookings',async(req,res)=>{
      const query={};
      if(req.query.userid){
       query.userid=req.query.userid
      }
      if(req.query.vendorId){
       query.vendorId=req.query.vendorId
      }
      const result= await bookingsCollection.find(query).toArray();
      res.send(result)
    })

    app.post('/api/bookings',async(req,res)=>{
      const booking= req.body;
      console.log(booking);
      const newBooking={
        ...booking,
        status: "pending",
         createdAt: new Date()
      }
      const result= await bookingsCollection.insertOne(newBooking);
      res.send(result);
    })


    app.patch('/api/bookings/:id',verifyToken,verifyVendor, async(req,res)=>{
      const id= req.params.id;
      const {status}=req.body;
      const result= await bookingsCollection.updateOne(
        {_id:new ObjectId(id)},
       {  $set:{status}}
      )
      res.send(result)
    })


    app.post('/api/payments', async (req,res)=>{
 const paymentData=req.body;
 const existingPayment= await paymentsCollection.findOne({
  stripeSessionId: paymentData.stripeSessionId
 })
 if(existingPayment){
  return res.status(409).send({message:"Payment already recorded"})
 }

const ticket =
  await ticketsCollection.findOne({
    _id: new ObjectId(
      paymentData.ticketId
    )
  });
  if(ticket.quantity<paymentData.bookingQuantity){
  return res.status(400).send({ message: "Not enough tickets available" });
}

 const newPaymentData={
  ...paymentData,
  paymentStatus:"paid",
  createdAt:new Date()
 }


 const result= await paymentsCollection.insertOne(newPaymentData);
 if(result.insertedId){
   await bookingsCollection.updateOne({_id: new ObjectId(paymentData.bookingId)},
 { $set:{status:'paid'}}
)

await ticketsCollection.updateOne({_id: new ObjectId(paymentData.ticketId)},
{$inc:{
  quantity:-paymentData.bookingQuantity
}}
)
 }
 res.send(result)
    })

 app.get('/api/payments/:userId',async(req,res)=>{
  const userId=req.params.userId;
  const result = await paymentsCollection.find({userId}).sort({createdAt:-1}).toArray();
  res.send(result)
 })   

 app.get('/api/vendor/revenue/:vendorId', async (req,res)=>{
    const result=await paymentsCollection.aggregate([
      {
        $match:{
          vendorId:req.params.vendorId
        }
      },
      {
        $group:{
          _id:null,
        totalRevenue:{
          $sum:"$amount"
        },
         totalSold:{
            $sum:{
              $toInt: "$bookingQuantity"
            }
          
          }
        
        }
      }
    ]).toArray();
   
    const vendorAddedTicket= await ticketsCollection.aggregate([
      {
        $match:{
          vendorId:req.params.vendorId
        }
      },
      {
        $group: {
          _id:null,
          totalTicketsAdded:{
            $sum:"$originalQuantity"
          }
        }
      }
    ]).toArray();
    const totalTicket= vendorAddedTicket[0] || {totalTicketsAdded:0}
    console.log( vendorAddedTicket[0] )
    const revenue= result[0] || { totalRevenue:0, totalSold:0};
    res.send(
      {totalTicketsAdded:totalTicket.totalTicketsAdded,
      totalRevenue : revenue.totalRevenue,
      totalSold : revenue.totalSold,
}
    )
 })

 app.get('/api/ticket/advertise',async(req,res)=>{
   
  const result= await ticketsCollection.find({verificationStatus:"approved", isAdvertised:true}).toArray();
  res.json(result)
       
 })
 app.patch('/api/tickets/advertise/:id',async(req,res)=>{
  const id= req.params.id;
 const { isAdvertised}=req.body;
  const advertiseCount= await ticketsCollection.countDocuments({
    isAdvertised:true
  })
  if(isAdvertised && advertiseCount>=6){
    return res.status(400).send({message:"Maximum 6 ticket can be advertised"})
  }

  const result= await ticketsCollection.updateOne({
    _id: new ObjectId(id)
  },
  {
  $set:{isAdvertised:isAdvertised}
  }
)
res.send(result)
 })

 app.get('/api/ticket/latest',async(req,res)=>{
  const result= await ticketsCollection.find({
      verificationStatus:"approved",
  }).sort({createdAt:-1}).limit(8).toArray()
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