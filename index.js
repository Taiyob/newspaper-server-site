const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      ["http://localhost:5173", "https://newspaper-688b0.web.app"].includes(
        origin
      )
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9bycbcd.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("newspaper").collection("users"); // user table
    const slidersCollection = client.db("newspaper").collection("sliders"); // slider table
    const paymentsCollection = client.db("newspaper").collection("payments"); // payment table
    const publishersCollection = client
      .db("newspaper")
      .collection("publishers"); // publisherstable
    const articlesCollection = client.db("newspaper").collection("articles"); // publishers table

    // Token Generate:
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        console.log("I need a new jwt", user);
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1d",
        });
        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (error) {
        console.error("Error in /jwt endpoint:", error);
        res
          .status(500)
          .send({ success: false, error: "Internal Server Error" });
      }
    });

    // User create and update
    app.put("/user/:email", async (req, res) => {
      const body = req.body;
      const email = req.params.email;
      const query = { email: email };
      const options = { upsert: true };
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        res.status(409).send({
          message:
            "This email account already registered!!! Please login with this email",
        });
      }
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...body, timestamp: Date.now() },
        },
        options
      );
      res.send(result);
    });

    // Slider content showing:
    app.get("/slider-data", async (req, res) => {
      const result = await slidersCollection.find().toArray();
      res.send(result);
    });

    // Slider content generate:
    app.post("/slider-data-generate",verifyToken, async (req, res) => {
      const body = req.body;
      const result = await slidersCollection.insertOne(body);
      res.send(result);
    });

    // Publisher showing:
    app.get("/show-publisher", async (req, res) => {
      const result = await publishersCollection.find().toArray();
      res.send(result);
    });

    // Publisher generate:
    app.post("/add-publisher",verifyToken, async (req, res) => {
      const body = req.body;
      const result = await publishersCollection.insertOne(body);
      res.send(result);
    });

    // Article get:
    app.get("/show-article",verifyToken, async (req, res) => {
      const result = await articlesCollection.find().toArray();
      res.send(result);
    });

    // Single article get:
    app.get("/show-article/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articlesCollection.findOne(query);
      res.send(result);
    });

    // Article add:
    app.post("/add-article",verifyToken, async (req, res) => {
      const body = req.body;
      const result = await articlesCollection.insertOne(body);
      res.send(result);
    });

    // Artical Approved:
    app.patch("/admin/article-approve/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await articlesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Payment Intent:
    app.post("/create-payment-intent",verifyToken, async (req, res) => {
      try {
        const { prices } = req.body;
        if (isNaN(prices) || prices <= 0) {
          console.error("Invalid price:", prices);
          return res.status(400).send({ error: "Invalid price" });
        }
        console.log("Received request with price:", prices);
        const amount = parseInt(prices * 100);
        console.log(amount);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // Payment get:
    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      // if (req.params.email !== req.decoded.email) {
      //   return res.status(403).send({ message: "forbidden access" });
      // }
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });

    // Payment related:
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentsCollection.insertOne(payment);
      res.send(paymentResult);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

//
