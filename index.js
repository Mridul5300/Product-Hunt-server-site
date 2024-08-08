const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const app = express();
const { MongoClient, ServerApiVersion, ObjectId,  } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIP_SCRET_KEY);

const port = process.env.PORT || 5000;

// midleware

app.use(cors());
app.use(express.json());

// console.log('DB_USER:', process.env.DB_USER);
// console.log('DB_PASS:', process.env.DB_PASS);
// console.log('ACCESS_TOKEN_SECRET:', process.env.ACCESS_TOKEN_SECRET);
// console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1mv6arg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const ProductCollection = client.db("producthunt").collection("product");
    const reviewCollection = client.db("producthunt").collection("review");
    const userCollection = client.db("producthunt").collection("user");

  // jwt related api
  app.post('/jwt', async(req, res) => {
    const user = req.body;
    console.log(user);
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1D'});
  
    res.send({ token })
  })

  // middleware
  const verifyToken = (req, res, next) => {
    // console.log('inside verify tiken',req.headers.authorization);
    if(!req.headers.authorization){
      return res.status(401).send({message: 'forbidden access'})
    }
    const token = req.headers.authorization.split( ' ' )[1];
    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if(err){
        return res.status(401).send({message: 'forbidden access'})
      }
      req.decoded = decoded;
        next();
    })
  
  };

  // verifyadmin
  const verifyAdmin = async(req,res,next) =>{
    const email = req.decoded.email;
    const query = { email: email};
    const user = await userCollection.findOne(query);
    const isAdmin = user?.role === 'admin';
    if(!isAdmin){
      return res.status(403).send({message:'forbidden access'});
    }
    next()
  }
// verifymoderato
const verifymoderator = async(req,res,next) =>{
  const email = req.decoded.email;
  const query = { email: email};
  const user = await userCollection.findOne(query);
  const isAdmin = user?.role === 'moderator';
  if(!isAdmin){
    return res.status(403).send({message:'forbidden access'});
  }
  next()
}

    // user related api
    app.get('/user',verifyToken,  verifyAdmin ,  async (req,res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
        })

        app.get('/user/admin/:email', verifyToken, async(req, res) =>{
          const email = req.params.email;
          if(email !== req.decoded.email){
            return res.status(403).send({message:'unauthorized access'})
          }
          const query = {email: email};
          const user = await userCollection.findOne(query);
          let admin = false;
        if(user){
          admin = user?.role === "admin";
        }
        res.send({admin})
  });

  // moderator
        app.get('/user/moderator/:email',verifyToken,verifymoderator, async(req, res) =>{
          const email = req.params.email;
          if(email !== req.decoded.email){
            return res.status(403).send({message:'unauthorized access'})
          }
          const query = {email: email};
          const user = await userCollection.findOne(query);
          let moderator = false;
        if(user){
          moderator = user?.role === "moderator";
        }
        res.send({moderator})
  })

    app.post('/user',  async (req,res) => {
      const user = req.body 
      const query = {email: user?.email}
      const existinguser = await userCollection.findOne(query);
      if(existinguser){
        return res.send({message: "user already exists", insertedId : null})
      }
      const result = userCollection.insertOne(user)
      res.send(result)
    })

    app.patch('/user/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role:'admin'
        }
      }
      const result = await userCollection.updateOne(filter,updateDoc);
      res.send(result)
    })
    app.patch('/user/moderator/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role:'moderator'
        }
      }
      const result = await userCollection.updateOne(filter,updateDoc);
      res.send(result)
    })

    app.delete('/user/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    
    app.get('/product', async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      // console.log(page);
      
      const limit = parseInt(req.query.limit) || 6;
      // console.log(limit);
      
      const searchBar = req.query.search;
      const skip = (page - 1) * limit;
      const query = searchBar ? { Tags: { $regex: searchBar, $options: "i" } } : {};
      const sort = { timestamp: -1 };
    
      const products = await ProductCollection.find(query).sort(sort).skip(skip).limit(limit).toArray();
      const totalCount = await ProductCollection.countDocuments(query);
          // console.log(products);
          
      res.send({
        products,
        totalPages: Math.ceil(totalCount / limit),  
          });
  });
  


    // vote system
    app.post('/products/:id/vote', async (req, res) => {
      const {id} = req.params
      const result = await ProductCollection.findOneAndUpdate(
      {  _id: new ObjectId(id) },
      { $inc: {vote: +1}},
      { returnOrginal: false}

      )
      console.log(result);
      res.send(result.value)
    })
    // reported System
    app.post('/products/:id/report', async (req, res) => {
      const {id} = req.params
      const result = await ProductCollection.findOneAndUpdate(
      {  _id: new ObjectId(id) },
      { $set: { reported: true }},
      { returnOrginal: false}

      )
      console.log(result);
      res.send(result.value)
    })

    app.get('/review/:id', async (req, res) => {
      const id = req.params.id;
      const query = { productId: id };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });
  

      app.post('/review', async (req, res) => {
        const review = req.body;
        const result = await reviewCollection.insertOne(review)
        res.send(result)
      })
    app.get('/productdetail/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await ProductCollection.findOne(query);
      res.send(result);
      });

// dash Board Structure
    app.get('/myproduct/:email', async (req, res) => {
      const email = req.params.email;
      const query = { 'host.email': email };
      const products = await ProductCollection.find(query).toArray();
      res.send(products); 
    });

    app.post('/addproduct', async (req,res) => {
      const productdata = req.body
      console.log(productdata);
      
      const result = await ProductCollection.insertOne(productdata)
      res.send(result)
    })

    app.put('/myproduct/:id', async (req, res) => {
      const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateData = req.body.productdata;
      console.log(updateData);
      // const options = { upsert: true };
      const updateDoc = {
        $set: {
          
          SoftwareName: updateData.SoftwareName,
            SoftwareImage: updateData.SoftwareImage,
            SoftwareDescription: updateData.SoftwareDescription,
            ExternalLink: updateData.ExternalLink,
            Tags: updateData.Tags
        }
      }

      const result = await ProductCollection.updateOne(filter, updateDoc);
      res.send(result)

    })


    app.patch('/myproduct/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }; 
      const updateDoc = {
        $set: {
          
        statuse : "Pending"
        }
      }

      const result = await ProductCollection.updateOne(filter, updateDoc);
      res.send(result)

    })

    app.patch('/myproduct/reject/:id' , async (req,res) => {
      const id = req.params.id
        const filter = { _id: new ObjectId(id) }
        const updateDoc = {
          $set: {
            
          statuse : "rejected"
          }
        }
        const result = await ProductCollection.updateOne(filter,updateDoc)
        res.send (result)
    })

    app.delete('/product/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await ProductCollection.deleteOne(query);
      res.send(result)
    });
    // payment intent
    app.post ('/creat-payment-intent' , async (req, res) => {
      const { price } =req.body;
      if (price < 0.5) {
        return res.status(400).send({
          error: "The amount must be at least $0.50."
        });
      }
      const amount = parseInt( price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency:'usd',
        payment_method_types: ['card']
      })
      res.send({
        clintSecret: paymentIntent.clint_secret
      })
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


app.get('/', (req, res) => {
     res.send('Ai Is Runnig')
   })
   
   app.listen(port, () => {
     console.log(`Ai Server IS Ready${port}`);
   })