const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY)

const cookieParser = require('cookie-parser')
const moment = require('moment');

app.use(cors(
    {
        origin: [
            'http://localhost:5173'
            // 'https://ecommerce-project-b67b1.firebaseapp.com',
            // 'https://ecommerce-project-b67b1.web.app'
        ],
        credentials: true
    }
))
app.use(express.json())
app.use(cookieParser())
const port = process.env.PORT || 5000

const logger = async (req, res, next) => {
    console.log('called', req.method, req.originalUrl);
    next()
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: Stripe } = require('stripe');
const { Await } = require('react-router-dom');
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_PASSWORD}@cluster0.id4vsgi.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {

    const mostVotedSurveys = client.db('surveyDB').collection('allsurvey')

    const allcreatedsurvey = client.db('surveyDB').collection('allcreatedsurvey')
    const allvotedfeature = client.db('surveyDB').collection('allvotedfeature')
    const alluser = client.db('surveyDB').collection('alluser')
    const paymentcollection = client.db('surveyDB').collection('paymentcollection')


    const verifyToken = async (req, res, next) => {
        const token = req.cookies?.token
        // console.log('value of token', token)
        if (!token) {
            return res.status(401).send({ message: 'forbidden' })
        }
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).send({ message: 'unauthorized' })
            }
            // req.user = decoded
            req.decoded = decoded
            
             next()
        })
    
    }
    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await alluser.findOne(query);
        
        if (!user || user.role !== 'admin') {
            return res.status(403).send({ message: 'Unauthorized access' });
        }
        
        next();
    };
    

    // auth api
    app.post('/jwt', async (req, res) => {
        const user = req.body
        // console.log('user for token', user);
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', 
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            // secure: true,
            // sameSite: 'none'
        })
         res.send({success:true})
    })
    app.post('/logout', async (req, res) => {
        const user = req.body
        console.log('loging out', user);
        res.clearCookie('token', { maxAge: 0 }).send({ success: true })

    })

    //users api 

    app.get('/alluser/surveyor/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        const user = await alluser.findOne({ email: email });
    
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
    
        const isSurveyor = user.role === 'surveyor';
        res.json({ surveyor: isSurveyor });
    });
    
    app.get('/alluser/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        const user = await alluser.findOne({ email: email });
    
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
    
        const isAdmin = user.role === 'admin';
        res.json({ admin: isAdmin });
    });
    
    
    app.get('/alluser', verifyToken,async (req, res) => {
        const result = await alluser.find().toArray();
        res.send(result);
    });
    
    app.patch('/alluser/admin/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                role: 'admin'
            }
        };
        try {
            const result = await alluser.findOneAndUpdate(filter, updatedDoc, { returnOriginal: false });
            res.send(result.value); // Send the updated user data back
        } catch (error) {
            res.status(500).send({ error: 'Error updating user role' });
        }
    });
    
    app.patch('/alluser/surveyor/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                role: 'surveyor'
            }
        };
        try {
            const result = await alluser.findOneAndUpdate(filter, updatedDoc, { returnOriginal: false });
            res.send(result.value); // Send the updated user data back
        } catch (error) {
            res.status(500).send({ error: 'Error updating user role' });
        }
    });
    

    app.post('/alluser',verifyToken, async (req, res) => {
        const user = req.body;
        const query={email:user.email}
        const existinguser=await alluser.findOne(query)
        if(existinguser){
            return res.send({message:'user already exists',insertedId :null})
        }
        const result = await alluser.insertOne(user)
        res.send(result)
    })
// vote related api

    app.post('/allvotedfeature', verifyToken, async (req, res) => {
        const voteRecord = req.body;
        console.log(voteRecord);
        const timestamp = moment().format();
        voteRecord.timestamp = timestamp;
        const result = await allvotedfeature.insertOne(voteRecord)
        res.send(result)
    })
    // app.get('/allvotedfeature/:email/:id',verifyToken, async (req, res) => {
    //     const { email, id } = req.params;
    //     console.log(email,id);
    //     const existingVote = await allvotedfeature.findOne({ userId: email, surveyId: id });

    //     if (existingVote) {
    //         res.status(200).json({ hasVoted: true });
    //     } else {
    //         res.status(200).json({ hasVoted: false });
    //     }
    // })

    app.get('/allvotedfeature/:email/:id', verifyToken, async (req, res) => {
        try {
            const { email, id } = req.params;
    
            console.log('Received params:', email, id);
    
            const existingVote = await allvotedfeature.findOne({ email: email, surveyId: id });
    
            console.log('Existing vote:', existingVote);
    
            if (existingVote) {
                res.status(200).json({ hasVoted: true });
            } else {
                res.status(200).json({ hasVoted: false });
            }
        } catch (error) {
            console.error('Error while checking existing votes:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    
    // app.get('/allvotedfeature/:email/:id', verifyToken, async (req, res) => {
    //     const { email, id } = req.params;
    //     console.log(email, id);
    //     try {
    //         const existingVotes = await allvotedfeature.find({ userId: email, surveyId: id });
            
    //         if (existingVotes.length > 0) {
    //             res.status(200).json({ hasVoted: true });
    //         } else {
    //             res.status(200).json({ hasVoted: false });
    //         }
    //     } catch (error) {
    //         console.error('Error while checking existing votes:', error);
    //       
    

    app.get('/allcreatedsurvey', async (req, res) => {
        
        const result = await allcreatedsurvey.find().toArray()
        res.send(result)
    })
    app.post('/allcreatedsurvey', async (req, res) => {
        const formdata = req.body
        console.log(formdata);
        const timestamp = moment().format();
        formdata.timestamp = timestamp;
        

        const result = await allcreatedsurvey.insertOne(formdata)
        res.send(result)
    })
 
    app.post("/create-payment-intent", async (req, res) => {
        const { price } = req.body;
        console.log("Received price:", price); 
    
        const amount = parseInt(price * 100);
        // console.log('getttttt',amount);
    
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });
    
            console.log("Client secret generated:", paymentIntent.client_secret); // Log the client_secret
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        } catch (error) {
            console.error("Error creating payment intent:", error.message); // Log any errors
            res.status(500).send({ error: error.message });
        }
    });

    app.get('/payments',verifyToken,verifyAdmin,async(req,res)=>{
        const result=await paymentcollection.find().toArray()
        res.send(result)

    })
    
    app.get('/payments/:email',verifyToken,async(req,res)=>{
        const query={email:req.params.email}
        if(req.params.email!==req.decoded.email){
            return req.status(403).send({message:'access forbidden'})
        }
        const result=await paymentcollection.find(query).toArray()
        res.send(result)

    })
    
// for pro user:to do


    // app.post ('/payments',async(req,res)=>{
    //     const payment=req.body
    //     paymentresult=await paymentcollection.insertOne(payment)
    //     console.log('payment info',payment);
    //     const query={
    //         $in:payment.email

    //     }
    //     const updateuserrole=await alluser.updateOne(query)
    //     res.send(paymentresult,updateuserrole)
    // })
    app.post('/payments', async (req, res) => {
        const payment = req.body;
    
        // Insert payment information into payment collection
        const paymentResult = await paymentcollection.insertOne(payment);
        console.log('Payment info', payment);
    
        // Check if email exists in the payment object
        if (payment.email) {
            // Define the query to find the user by email
            const query = { email: payment.email };
    
            // Update user role in alluser collection
            const updatedUser = await alluser.updateOne(query, {
                $set: { role: 'prouser' /* Set the role to the desired value */ }
            });
    
            // Send response with payment result and update result
            res.send({ paymentResult, updatedUser });
        } else {
            // Send response with only payment result if email is not found
            res.send({ paymentResult });
        }
    });
    

    try {

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('survey is ongoing')
})

app.listen(port, () => {
    console.log(`port is running on${port}`);
})

