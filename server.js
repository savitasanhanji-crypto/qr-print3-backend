// server.js
require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

// Routes
const stopRoutes = require("./routes/stopRoutes");
const conductorRoutes = require("./routes/conductorRoutes");
const passRoutes = require("./routes/passRoutes");
const busRoutes = require("./routes/busRoutes");
const ticketRoute = require("./routes/ticketRoutes");
const posRoutes = require('./routes/pos'); // ← Add this line

const app = express();

// ✅ CORS CONFIG (Permanent fix)
const allowedOrigins = [
  "http://localhost:8081",     // Expo/Web during development ( Backend change )
 "http://152.59.7.197:8081",
  
  "http://yourdomain.com",    // Production domain
];

app.use(cors({
  origin: "*",  // Allow all origins
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use('/api/pos', posRoutes); // ← Add this line

// Middleware
app.use(bodyParser.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
.then(() => {
  console.log("✅ Connected to MongoDB Atlas");
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  });
})
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
});

// Mount routes
app.use("/bus", busRoutes);
app.use("/api/Stop", stopRoutes);
app.use("/api/stops", stopRoutes);
app.use("/api/tickets", ticketRoute);
app.use("/conductor", conductorRoutes);
app.use("/api/passes", passRoutes);