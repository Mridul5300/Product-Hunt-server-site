const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId,  } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;

// midleware
app.use(cors());
app.use(express.json());



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
    // const userCollection = client.db("producthunt").collection("user");

  

    // user colleection

    // app.put('/user', async (req,res) => {
    //   const user = req.body 

    //   const option = { upsert:true}

    //   const query = {email: user?.email}
    //   const updateDoc = {
    //     $set: {
    //       ...user,
    //     }
    //   }
    //   const result = userCollection.updateOne(query,user,option)
    //   res.send(result)
    // })


    app.get('/product', async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 6;
      const searchBar = req.query.search;
      const skip = (page - 1) * limit;
      const query =  searchBar  ? {  SoftwareName : { $regex: searchBar, $options: "i" } } : {};
      const products = await ProductCollection.find(query).skip(skip).limit(limit).toArray();
      const totalCount = await ProductCollection.countDocuments(query);
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
    app.post('/products/:id/vote', async (req, res) => {
      const {id} = req.params
      const result = await ProductCollection.findOneAndUpdate(
      {  _id: new ObjectId(id) },
      { $set: "Reportd"},
      { returnOrginal: false}

      )
      console.log(result);
      res.send(result.value)
    })
    // review system
    app.get('/review/:id', async (req, res) => {
      const {productId} = req.params
      const query =  {productId:productId} ;
      const result = await reviewCollection.findOne(query);
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
      res.send(products); // Directly send the array of products
    });

    app.post('/addproduct', async (req,res) => {
      const productdata = req.body
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
          
        statuse : "accepted"
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