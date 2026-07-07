const mongoose = require("mongoose");
const conductorSchema = new mongoose.Schema(
  {
    name: { type: String },
    batch_no: { type: String },
    password: { type: String },
    phone_no: { type: String, default: "" },
    type: { type: String, default: "" },
  },
  { collection: "Conductor" }
);
module.exports = mongoose.model("Conductor", conductorSchema);