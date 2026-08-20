require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "WhatsApp Backend is running 🚀",
  });
});

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB Error:", err));

// Routes
app.use("/api", require("./routes/subscribe"));
app.use("/api", require("./routes/messages"));
app.use("/api", require("./routes/webhook"));

// Export app for Vercel
module.exports = app;