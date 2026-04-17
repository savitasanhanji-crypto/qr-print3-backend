const express = require("express");
const router = express.Router();
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");

const getModel = (name, schema, collection) => {
  return mongoose.models[name] || mongoose.model(name, new mongoose.Schema(schema, { collection }));
};

// GET /api/tickets/summary
router.get("/summary", async (req, res) => {
  try {
    const { batch_no, date } = req.query;
    const queryDate = date ? new Date(date) : new Date();
    const start = new Date(queryDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(queryDate);
    end.setHours(23, 59, 59, 999);
    const dateStr = queryDate.toISOString().slice(0, 10);
    const dateParts = dateStr.split("-");

    const query = {
      $or: [
        { dateTime: { $gte: start, $lte: end } },
        { date: { $regex: dateParts[2] + "/" + dateParts[1] } },
      ],
      ...(batch_no ? { batch_no } : {}),
    };

    const tickets = await Ticket.find(query);
    console.log("Summary found:", tickets.length, "tickets for", dateStr, "batch:", batch_no);

    let totalTickets = 0, totalFare = 0, cashFare = 0, onlineFare = 0;
    let totalAdult = 0, totalChild = 0;
    const passCountSummary = {};

    tickets.forEach(t => {
      if (t.paymentMode !== "Pass") {
        totalTickets++;
        totalFare += t.price || 0;
        if (t.paymentMode === "Cash") cashFare += t.price || 0;
        if (t.paymentMode === "Online") onlineFare += t.price || 0;
      }
      totalAdult += Number(t.adultCount) || 0;
      totalChild += Number(t.childCount) || 0;
      if (t.passCounts && typeof t.passCounts === "object") {
        Object.entries(t.passCounts).forEach(([pass, count]) => {
          passCountSummary[pass] = (passCountSummary[pass] || 0) + Number(count);
        });
      }
    });

    res.status(200).json({
      success: true, date: dateStr,
      batch_no: batch_no || "All",
      totalTickets, totalFare, cashFare, onlineFare,
      totalAdult, totalChild, passCountSummary,
      totalTransactions: tickets.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch summary", error: err.message });
  }
});

// POST /api/tickets
router.post("/", async (req, res) => {
  try {
    const { busNumber, batch_no } = req.body;

    const ConductorBus = getModel("conductor_bus_lookup", { conductor_id: String, bus_assigned: String }, "conductor_bus");
    const BusPos = getModel("buspos_model", { bus: mongoose.Schema.Types.ObjectId, posMachine: mongoose.Schema.Types.ObjectId }, "buspos");
    const PosMachine = getModel("posmachines_model", { deviceId: String, MID: String, machineId: String, serialNumber: String }, "posmachines");
    const Bus = getModel("buses_model", { busNumber: String, name: String }, "buses");

    let routeNumber = "", machineId = "", MID = "", resolvedBusNumber = busNumber;

    // Step 1: Get bus from conductor_bus
    if (batch_no) {
      const conductorBus = await ConductorBus.findOne({ conductor_id: batch_no }).catch(() => null);
      if (conductorBus) resolvedBusNumber = conductorBus.bus_assigned || busNumber;
    }

    // Step 2: Get bus document
    const bus = await Bus.findOne({ busNumber: resolvedBusNumber }).catch(() => null);
    if (bus) {
      routeNumber = bus._id.toString().slice(-6).toUpperCase();

      // Step 3: Get posMachine via buspos
      const busPos = await BusPos.findOne({ bus: bus._id }).catch(() => null);
      if (busPos) {
        const posMachine = await PosMachine.findById(busPos.posMachine).catch(() => null);
        if (posMachine) {
          // Use MID field from posmachines collection
          MID = posMachine.MID || posMachine.machineId || posMachine.serialNumber ||
                posMachine._id.toString().slice(-4).toUpperCase();
          machineId = MID;
        }
      }
    }

    if (!routeNumber) routeNumber = resolvedBusNumber;

    // Get today's running serial
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Ticket.countDocuments({ dateTime: { $gte: today } }).catch(() => 0);
    const serial = String(todayCount + 1).padStart(5, "0");

    // Ticket number: SUR-YYYYMMDD-MID-XXXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const ticketNumber = `SUR-${dateStr}-${MID || "000"}-${serial}`;

    const ticketData = { ...req.body, ticketNumber, routeNumber, machineId: MID, busNumber: resolvedBusNumber };
    const ticket = new Ticket(ticketData);
    await ticket.save();

    res.status(200).json({
      success: true, message: "Ticket saved successfully",
      ticketNumber, routeNumber, machineId: MID, busNumber: resolvedBusNumber,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save ticket", error: err.message });
  }
});

module.exports = router;

