const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// GET fare chart
router.get("/farechart", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const fareDoc = await db.collection("fareCharts").findOne({ type: "fareChart" });
    if (!fareDoc) {
      return res.status(404).json({ message: "Fare chart not found" });
    }
    res.json(fareDoc);
  } catch (err) {
    res.status(500).json({ message: "Error fetching fare chart" });
  }
});

// PUT update fare chart
router.put("/farechart", async (req, res) => {
  try {
    const { fares } = req.body;
    const db = mongoose.connection.db;
    await db.collection("fareCharts").updateOne(
      { type: "fareChart" },
      { $set: { fares: fares } },
      { upsert: true }
    );
    res.json({ message: "Fare chart updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error updating fare chart" });
  }
});

// POST calculate fare
router.post("/calculate-fare", async (req, res) => {
  try {
    const { routeId, from, to } = req.body;

    if (!routeId || !from || !to) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!mongoose.Types.ObjectId.isValid(routeId)) {
      return res.status(400).json({ message: "Invalid route ID" });
    }

    // Get route
    const db = mongoose.connection.db;
    const route = await db.collection("routes").findOne({
      _id: new mongoose.Types.ObjectId(routeId)
    });

    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }

    const stops = route.trips?.[0]?.stops || [];
    if (stops.length === 0) {
      return res.status(400).json({ message: "No stops found in route" });
    }

    // Find from stop - use sequence as stage
    let fromStage = 0;
    if (from !== "SOURCE") {
      const fromStop = stops.find(
        (s) => s.name.toLowerCase() === from.toLowerCase()
      );
      if (!fromStop) {
        return res.status(404).json({ message: "From stop not found" });
      }
      fromStage = fromStop.stage !== undefined ? fromStop.stage : fromStop.sequence;
    }

    // Find to stop
    const toStop = stops.find(
      (s) => s.name.toLowerCase() === to.toLowerCase()
    );
    if (!toStop) {
      return res.status(404).json({ message: "To stop not found" });
    }
    const toStage = toStop.stage !== undefined ? toStop.stage : toStop.sequence;

    // Calculate distance
    const distance = Math.abs(toStage - fromStage);

    // Get fare chart
    const fareDoc = await db.collection("fareCharts").findOne({ type: "fareChart" });
    if (!fareDoc) {
      return res.status(500).json({ message: "Fare chart not found" });
    }

    const fareChart = fareDoc.fares;
    const fare = fareChart[distance] || fareChart[String(distance)] || 0;

    res.json({ from, to, fromStage, toStage, distance, fare });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST get stops for a route
router.post("/route-stops", async (req, res) => {
  try {
    const { routeId } = req.body;
    if (!routeId || !mongoose.Types.ObjectId.isValid(routeId)) {
      return res.status(400).json({ message: "Invalid route ID" });
    }
    const db = mongoose.connection.db;
    const route = await db.collection("routes").findOne({
      _id: new mongoose.Types.ObjectId(routeId)
    });
    if (!route) {
      return res.status(404).json({ message: "Route not found" });
    }
    const stops = route.trips?.[0]?.stops || [];
    const sorted = [...stops].sort((a, b) =>
      (a.sequence || 0) - (b.sequence || 0)
    );
    res.json({ success: true, stops: sorted });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;