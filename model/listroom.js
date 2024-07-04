import mongoose from "mongoose";

const listRoomSchema = new mongoose.Schema({
  namatempat: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["Accepted", "Rejected", "Pending", 'Available'],
    default: "Available",
  },
});

const ListRoom = mongoose.model("ListRoom", listRoomSchema);
export default ListRoom;
