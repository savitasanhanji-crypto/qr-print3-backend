// routes/busRoutes.js
const express = require("express");
const Bus = require("../models/Bus");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const buses = await Bus.find({}, "busNumber"); // fetch only busNumber field
    res.json({ success: true, buses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
module.exports = router;