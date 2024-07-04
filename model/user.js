import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  bookingsConfirmed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
});

const User = mongoose.model("User", UserSchema);

export default User;

