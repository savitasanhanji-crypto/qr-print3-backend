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

    let totalTickets = 0, totalFare = 0, cashFare = 0, onlineFare = 0;
    let totalAdult = 0, totalChild = 0;
    let totalLuggageCount = 0, totalLuggageFare = 0;
    let totalBoarded = 0, totalAlighted = 0;
    const passCountSummary = {};
    const stopSummary = {};
    const routeSummary = {};

    tickets.forEach(t => {
      // Group by route
      const routeKey = t.routeNumber || t.busNumber || "Unknown";
      if (!routeSummary[routeKey]) {
        routeSummary[routeKey] = {
          routeNumber: routeKey,
          busNumber: t.busNumber || "",
          totalTickets: 0, totalFare: 0,
          cashFare: 0, onlineFare: 0,
          totalAdult: 0, totalChild: 0,
          totalBoarded: 0, totalAlighted: 0,
          totalLuggageCount: 0, totalLuggageFare: 0,
          passCountSummary: {},
        };
      }
      const rs = routeSummary[routeKey];
      if (t.paymentMode !== "Pass") {
        totalTickets++;
        totalFare += t.price || 0;
        if (t.paymentMode === "Cash") cashFare += t.price || 0;
        if (t.paymentMode === "Online") onlineFare += t.price || 0;
      }

      // Passenger counts
      const adultC = Number(t.adultCount) || 0;
      const childC = Number(t.childCount) || 0;
      totalAdult += adultC;
      totalChild += childC;
      rs.totalAdult += adultC;
      rs.totalChild += childC;

      // Tickets and fare
      if (t.paymentMode !== "Pass") {
        rs.totalTickets++;
        rs.totalFare += t.price || 0;
        if (t.paymentMode === "Cash") rs.cashFare += t.price || 0;
        if (t.paymentMode === "Online") rs.onlineFare += t.price || 0;
      }

      // Pass holders
      if (t.passCounts && typeof t.passCounts === "object") {
        Object.entries(t.passCounts).forEach(([pass, count]) => {
          passCountSummary[pass] = (passCountSummary[pass] || 0) + Number(count);
          rs.passCountSummary[pass] = (rs.passCountSummary[pass] || 0) + Number(count);
        });
      }

      // Luggage
      if (t.luggageCount && t.luggageAmount) {
        totalLuggageCount += Number(t.luggageCount) || 0;
        totalLuggageFare += (Number(t.luggageCount) || 0) * (Number(t.luggageAmount) || 0);
        rs.totalLuggageCount += Number(t.luggageCount) || 0;
        rs.totalLuggageFare += (Number(t.luggageCount) || 0) * (Number(t.luggageAmount) || 0);
      }

      // Passengers boarded
      const passHolderCount = t.passCounts ?
        Object.values(t.passCounts).reduce((a, b) => a + Number(b), 0) : 0;
      const boardedOnTicket = adultC + childC + passHolderCount;
      totalBoarded += boardedOnTicket;
      rs.totalBoarded += boardedOnTicket;

      // Track boarding stops
      if (t.boardingStop) {
        if (!stopSummary[t.boardingStop]) stopSummary[t.boardingStop] = { boarded: 0, alighted: 0 };
        stopSummary[t.boardingStop].boarded += boardedOnTicket;
      }

      // Track alighting stops
      if (t.destinationStop) {
        if (!stopSummary[t.destinationStop]) stopSummary[t.destinationStop] = { boarded: 0, alighted: 0 };
        stopSummary[t.destinationStop].alighted += boardedOnTicket;
        totalAlighted += boardedOnTicket;
        rs.totalAlighted += boardedOnTicket;
      }
    });

    res.status(200).json({
      success: true, date: dateStr,
      batch_no: batch_no || "All",
      totalTickets, totalFare, cashFare, onlineFare,
      totalAdult, totalChild, passCountSummary,
      totalLuggageCount, totalLuggageFare,
      totalBoarded, totalAlighted,
      stopSummary,
      routeSummary: Object.values(routeSummary),
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
    const db = mongoose.connection.db;

    let routeNumber = "", machineId = "", MID = "", resolvedBusNumber = busNumber;

    // Step 1: Get bus from conductor_bus
    if (batch_no) {
      const conductorBus = await db.collection("conductor_bus").findOne({ conductor_id: batch_no });
      if (conductorBus) resolvedBusNumber = conductorBus.bus_assigned || busNumber;
    }

    // Step 2: Get bus document
    const bus = await db.collection("buses").findOne({ busNumber: resolvedBusNumber });
    if (bus) {
      // Step 3: Get route from busroutes then routes collection
      const busRouteDoc = await db.collection("busroutes").findOne({ bus: bus._id });
      if (busRouteDoc) {
        const routeDoc = await db.collection("routes").findOne({ _id: busRouteDoc.route });
        if (routeDoc) {
          // Use routeId field from routes collection
          routeNumber = routeDoc.routeId || routeDoc._id.toString().slice(-6).toUpperCase();
          console.log("routeDoc.routeId:", routeDoc.routeId, "routeNumber:", routeNumber);
        }
      }

      // Step 4: Get MID from posmachines using deviceId
      const deviceId = req.body.deviceId || "";
      console.log("Looking up deviceId:", deviceId);
      if (deviceId) {
        const posMachine = await db.collection("posmachines").findOne({ deviceId: deviceId });
        console.log("POS Machine:", JSON.stringify(posMachine));
        if (posMachine && posMachine.serialNumber) {
          MID = posMachine.serialNumber.toString().slice(-4).toUpperCase();
        } else if (posMachine) {
          MID = posMachine._id.toString().slice(-4).toUpperCase();
        }
        machineId = MID;
        console.log("MID set to:", MID);
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