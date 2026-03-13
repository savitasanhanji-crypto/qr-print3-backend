// routes/stopRoute.js
const express = require("express");
const Stop = require("../models/Stop"); // ✅ correct relative path

const router = express.Router();

router.get("/stop/:busNumber", async (req, res) => {
  try {
    const busNumber = req.params.busNumber;
    console.log("Bus number received:", busNumber);

    // Fetch all stops for this bus
    const stops = await Stop.find({ busNumber });
    console.log("Stops found:", stops);

    if (!stops || stops.length === 0) {
      return res.status(404).json({ success: false, message: "No stops found" });
    }

    // Unique boarding and destination stops
    const boardingStops = [...new Set(stops.map(s => s.boardingStop))];
    const destinationStops = [...new Set(stops.map(s => s.destinationStop))];

    // Send full stops too for price lookup
    res.json({
      success: true,
      busNumber,
      boardingStops,
      destinationStops,
      stops // <--- include full documents with price
    });
  } catch (err) {
    console.error("Error fetching stops:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


module.exports = router; // ✅ CommonJS export
