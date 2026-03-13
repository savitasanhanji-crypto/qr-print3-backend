const mongoose = require('mongoose');

const busSchema = new mongoose.Schema(
  {
    busNumber: {
      type: String,
      required: true,
      trim: true,
    },
    type: String,
    capacity: Number,
    registrationNumber: String,
    status: {
      type: String,
      default: 'Active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bus', busSchema);
