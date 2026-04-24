const mongoose = require("mongoose");
const conductorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    batch_no: { type: String, required: true, unique: true },
    password: { type: String, required: true }
  },
  { collection: "conductors" }
);
module.exports = mongoose.model("Conductor", conductorSchema);