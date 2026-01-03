require('dotenv').config();

if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(bits, name, options = {}) {
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
      this.size = bits.length || 0;
      this.type = options.type || '';
      this.bits = bits;
    }
  };
}

const express = require("express");
const mongoose = require("mongoose");
const scrapeProducts = require("./scraper/scrapeProducts");
const Product = require("./models/Product");

const app = express();
const PORT = process.env.PORT || 3000;

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/scraper";
    await mongoose.connect(mongoURI);
    console.log("MongoDB connected successfully!");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
  }
};

connectDB();


mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Product Scraper API", status: "running" });
});

app.post("/scrape", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: "MongoDB not connected. Please start MongoDB or check connection string." 
      });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const result = await scrapeProducts(url);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/products", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: "MongoDB not connected. Please start MongoDB or check connection string." 
      });
    }

    const products = await Product.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
