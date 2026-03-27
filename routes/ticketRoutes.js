const express = require("express");
const router = express.Router();
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");

const BusRoute = mongoose.model("busroutes", new mongoose.Schema({
  bus: mongoose.Schema.Types.ObjectId,
  route: mongoose.Schema.Types.ObjectId,
  status: String,
}, { collection: "busroutes" }));

const BusPos = mongoose.model("buspos", new mongoose.Schema({
  bus: mongoose.Schema.Types.ObjectId,
  posMachine: mongoose.Schema.Types.ObjectId,
}, { collection: "buspos" }));

const PosMachine = mongoose.model("posmachines", new mongoose.Schema({
  machineId: String,
  serialNumber: String,
  name: String,
}, { collection: "posmachines" }));

const Route = mongoose.model("routes", new mongoose.Schema({
  source: String,
  destination: String,
  via: String,
}, { collection: "routes" }));

const Bus = mongoose.model("buses", new mongoose.Schema({
  busNumber: String,
  name: String,
}, { collection: "buses" }));

// POST /api/tickets
router.post("/", async (req, res) => {
  try {
    const { busNumber } = req.body;

    let routeNumber = "";
    let machineId = "";

    // Get bus document
    const bus = await Bus.findOne({ busNumber }).catch(() => null);
    console.log("Bus found:", bus);

    if (bus) {
      // Get route from busroutes
      const busRoute = await BusRoute.findOne({ bus: bus._id }).catch(() => null);
      console.log("BusRoute found:", busRoute);
      if (busRoute) {
        const route = await Route.findById(busRoute.route).catch(() => null);
        console.log("Route found:", route);
        if (route) {
          // Use source-destination as route number
          routeNumber = `${route.source}-${route.destination}`;
        }
      }

      // Get machine ID from buspos
      const busPos = await BusPos.findOne({ bus: bus._id }).catch(() => null);
      console.log("BusPos found:", busPos);
      if (busPos) {
        const posMachine = await PosMachine.findById(busPos.posMachine).catch(() => null);
        console.log("PosMachine found:", posMachine);
        if (posMachine) {
          machineId = posMachine.machineId || posMachine.serialNumber ||
                      posMachine._id.toString().slice(-8).toUpperCase();
        }
      }
    }

    // Get today's running serial
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Ticket.countDocuments({
      dateTime: { $gte: today },
    }).catch(() => 0);
    const serial = String(todayCount + 1).padStart(5, "0");

    // Ticket number: SUR-YYYYMMDD-MID-XXXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const midPart = machineId ? machineId.slice(-4) : "00";
    const ticketNumber = `SUR-${dateStr}-${midPart}-${serial}`;

    const ticketData = {
      ...req.body,
      ticketNumber,
      routeNumber,
      machineId,
    };

    const ticket = new Ticket(ticketData);
    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Ticket saved successfully",
      ticketNumber,
      routeNumber,
      machineId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save ticket", error: err.message });
  }
});

module.exports = router;