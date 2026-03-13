const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  busNumber: { type: String, required: true },
  batch_no: { type: String },
  boardingStop: { type: String, required: true },
  destinationStop: { type: String, required: true },
  price: { type: Number, required: true },
  paymentMode: { type: String, required: true },
  selectedPass: { type: String, default: "None" },
  passCounts: { type: Object, default: {} },
  dateTime: { type: Date, default: Date.now },
  date: { type: String },
  time: { type: String },
});

// The third parameter 'Ticket' forces collection name exactly
module.exports = mongoose.model("Ticket", ticketSchema, "Ticket");
