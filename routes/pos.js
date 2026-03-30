// Backend API Endpoint (Node.js/Express + MongoDB)
// File: routes/pos.js

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * POST /api/pos/bus-number
 * Get bus number for a POS device
 * 
 * Request body: { deviceId: "unique-device-id" }
 * Response: { success: true, busNumber: "MH-01-AB-1234" }
 */
router.post('/bus-number', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Step 1: Find POS machine by deviceId in posmachines collection
    const posMachine = await mongoose.connection.db
      .collection('posmachines')
      .findOne({ deviceId: deviceId });

    if (!posMachine) {
      return res.status(404).json({
        success: false,
        message: 'POS machine not found'
      });
    }

    // Step 2: Get the ObjectId of the POS machine
    const posMachineId = posMachine._id;

    // Step 3: Find bus-POS mapping in buspos collection
    const busPosMapping = await mongoose.connection.db
      .collection('buspos')
      .findOne({ posMachine: posMachineId });

    if (!busPosMapping) {
      return res.status(404).json({
        success: false,
        message: 'Bus assignment not found for this POS'
      });
    }

    // Step 4: Get the bus ObjectId
    const busId = busPosMapping.bus;

    // Step 5: Find bus details in buses collection
    const bus = await mongoose.connection.db
      .collection('buses')
      .findOne({ _id: busId });

    if (!bus || !bus.busNumber) {
      return res.status(404).json({
        success: false,
        message: 'Bus details not found'
      });
    }

    // Step 6: Return the bus number
    return res.json({
      success: true,
      busNumber: bus.busNumber,
      busId: busId.toString(),
      posMachineId: posMachineId.toString()
    });

  } catch (error) {
    console.error('Error fetching bus number:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;