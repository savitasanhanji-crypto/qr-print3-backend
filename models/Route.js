const mongoose = require('mongoose');

// Schema for each stop inside a trip
const stopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    timingOffset: { type: String, required: true }, // e.g. "12:20"
    latitude: { type: String, required: true },
    longitude: { type: String, required: true },
    sequence: { type: Number, required: true } // order of stop in route
  },
  { _id: true }
);

// Schema for each trip
const tripSchema = new mongoose.Schema(
  {
    sourceTime: { type: String, required: true }, // e.g. "12:00"
    destinationTime: { type: String, required: true }, // e.g. "14:00"
    stops: [stopSchema]
  },
  { _id: true }
);

// Main Route schema
const routeSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    via: { type: String, trim: true },
    distance: { type: Number, required: true }, // in km
    estimatedDuration: { type: Number, required: true }, // in minutes
    isActive: { type: Boolean, default: true },
    trips: [tripSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Route', routeSchema);
