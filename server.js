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
const posRoutes = require("./routes/pos");
const fareRoutes = require("./routes/fareRoutes");
const otpRoutes = require("./routes/otpRoutes");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Middleware MUST come before routes
app.use(bodyParser.json());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI)
.then(() => {
  console.log("Connected to MongoDB Atlas");
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
})
.catch(err => {
  console.error("MongoDB connection error:", err.message);
});

// Health check
app.get("/", (req, res) => res.json({ status: "ok", message: "SMT Bus API running" }));

// Mount routes
app.use("/bus", busRoutes);
app.use("/api/Stop", stopRoutes);
app.use("/api/stops", stopRoutes);
app.use("/api/tickets", ticketRoute);
app.use("/conductor", conductorRoutes);
app.use("/api/passes", passRoutes);
app.use("/api/pos", posRoutes);
app.use("/api", fareRoutes);
app.use("/conductor", otpRoutes);