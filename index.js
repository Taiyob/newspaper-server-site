const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

const app = express();
const corsOptions = {
  origin: ["http://localhost:5173", "https://newspaper-688b0.web.app"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

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
    const publishersCollection = client
      .db("newspaper")
      .collection("publishers"); // publishers table

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
    app.post("/slider-data-generate", async (req, res) => {
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
    app.post("/add-publisher", async (req, res) => {
      const body = req.body;
      const result = await publishersCollection.insertOne(body);
      res.send(result);
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
