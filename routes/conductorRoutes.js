const express = require("express");
const bcrypt = require("bcryptjs");
const Conductor = require("../models/Conductor");
const mongoose = require("mongoose");
const router = express.Router();

// Conductor login
router.post("/login", async (req, res) => {
  try {
    const { batch_no, password, deviceId } = req.body;

    // Step 1: Validate input
    if (!batch_no || !password) {
      return res.status(400).json({ success: false, message: "Please enter both Batch Number and Password" });
    }

    // Step 2: Check conductor exists
    const conductor = await Conductor.findOne({ batch_no });
    if (!conductor) {
      return res.status(404).json({ success: false, message: "Invalid Batch Number. Conductor not found." });
    }

    // Step 3: Validate password
    const isMatch = await bcrypt.compare(password, conductor.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect Password. Please try again." });
    }

    const db = mongoose.connection.db;

    // Step 4: Clear existing sessions
    await db.collection("conductor_sessions").updateMany(
      { batch_no, isActive: true },
      { $set: { isActive: false, logoutTime: new Date() } }
    );

    // Step 5: Check conductor_bus collection - get latest record
    const conductorBus = await db.collection("conductor_bus").findOne(
      { batch_no: batch_no },
      { sort: { assignedDate: -1 } }
    );

    if (!conductorBus) {
      return res.status(404).json({ success: false, message: "No bus assigned to this conductor. Please contact admin." });
    }

    // Step 6: Check assignedDate - should not be prior date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const assignedDate = new Date(conductorBus.assignedDate);
    assignedDate.setHours(0, 0, 0, 0);

    if (assignedDate < today) {
      return res.status(403).json({
        success: false,
        message: `Bus assignment expired on ${assignedDate.toLocaleDateString("en-IN")}. Please contact admin to update assignment.`,
        assignmentExpired: true,
      });
    }

    // Step 7: Get bus details
    const busNumber = conductorBus.assignedbusNumber;
    const busId = conductorBus.busId;

    if (!busId) {
      return res.status(404).json({ success: false, message: "Bus ID not found in assignment. Please contact admin." });
    }

    // Step 8: Get latest route assigned to bus from busroutes
    const busRoute = await db.collection("busroutes").findOne(
      { bus: new mongoose.Types.ObjectId(busId.toString()) },
      { sort: { _id: -1 } }
    );

    let assignedRoute = null;
    if (busRoute) {
      const route = await db.collection("routes").findOne({ _id: busRoute.route });
      if (route) {
        assignedRoute = {
          _id: route._id.toString(),
          routeId: route.routeId,
          source: route.source,
          destination: route.destination,
          label: `Route ${route.routeId}: ${route.source} → ${route.destination}`,
        };
      }
    }

    // Step 9: Create session
    const sessionToken = `${batch_no}_${Date.now()}`;
    await db.collection("conductor_sessions").insertOne({
      batch_no,
      conductorId: conductor._id.toString(),
      sessionToken,
      isActive: true,
      loginTime: new Date(),
      deviceId: deviceId || "unknown",
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      conductorId: conductor._id,
      conductorName: conductor.name,
      batch_no: conductor.batch_no,
      busNumber: busNumber || null,
      busId: busId ? busId.toString() : null,
      assignedRoute,
      sessionToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error. Please try again.", error: err.message });
  }
});

// Conductor logout
router.post("/logout", async (req, res) => {
  try {
    const { batch_no, sessionToken } = req.body;
    if (!batch_no) return res.status(400).json({ success: false, message: "batch_no required" });
    const db = mongoose.connection.db;
    await db.collection("conductor_sessions").updateOne(
      { batch_no, sessionToken, isActive: true },
      { $set: { isActive: false, logoutTime: new Date() } }
    );
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// Get assigned bus for conductor by batch_no
router.get("/bus/:batch_no", async (req, res) => {
  try {
    const { batch_no } = req.params;
    const db = mongoose.connection.db;
    const conductorBus = await db.collection("conductor_bus").findOne(
      { batch_no: batch_no },
      { sort: { assignedDate: -1 } }
    );
    if (!conductorBus) {
      return res.status(404).json({ success: false, message: "No bus assigned" });
    }
    res.status(200).json({ success: true, busNumber: conductorBus.assignedbusNumber, busId: conductorBus.busId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// Get bus number from POS device ID
router.get("/bus-by-pos/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const db = mongoose.connection.db;
    const posMachine = await db.collection("posmachines").findOne({ deviceId: deviceId });
    if (!posMachine) return res.status(404).json({ success: false, message: "POS machine not found" });
    const busPos = await db.collection("buspos").findOne({ posMachine: posMachine._id });
    if (!busPos) return res.status(404).json({ success: false, message: "No bus assigned to this POS" });
    const bus = await db.collection("buses").findOne({ _id: busPos.bus });
    if (!bus) return res.status(404).json({ success: false, message: "Bus not found" });
    return res.json({ success: true, busNumber: bus.busNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// Clear session (admin)
router.post("/clear-session", async (req, res) => {
  try {
    const { batch_no } = req.body;
    const db = mongoose.connection.db;
    await db.collection("conductor_sessions").updateMany(
      { batch_no },
      { $set: { isActive: false } }
    );
    res.json({ success: true, message: "Sessions cleared" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;