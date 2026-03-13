// models/Stop.js
const mongoose = require("mongoose");

const stopSchema = new mongoose.Schema({
  boardingStop: { type: String, required: true },
  destinationStop: { type: String, required: true },
  price: { type: Number, required: true },
  busNumber: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("stopprices", stopSchema, "stopprices");
