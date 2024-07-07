import jwt from "jsonwebtoken";
import User from "../model/user.js";

const verifyToken = (req, res, next) => {
  let token = req.headers["x-access-token"];

  if (!token) {
    return res.status(403).send({ message: "No token provided!" });
  }

  jwt.verify(token, process.env.SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized!" });
    }
    req.userId = decoded.id;
    next();
  });
};


const checkDuplicateUsername = async (req, res, next) => {
  try {
    const user = await User.findOne({
      username: req.body.username,
    });

    if (user) {
      return res
        .status(400)
        .send({ message: "Failed! username is already in use!" });
    }

    next();
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const isAdmin = async (req, res, next) => {
  const userId = req.userId;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized: Require admin role" });
    }
    req.isAdmin = true; 
    next();
  } catch (err) {
    console.error("Error checking admin role:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


const checkRoomAvailability = async (req, res, next) => {
  const { namatempat, jam_peminjaman } = req.body;

  try {
    const isRoomAvailable = await Booking.findOne({
      namatempat,
      $or: [
        {
          status: "Pending",
          $or: [
            {
              "jam_peminjaman.start": { $lt: jam_peminjaman.end },
              "jam_peminjaman.end": { $gt: jam_peminjaman.start },
            },
          ],
        },
        {
          status: "Accepted",
          "jam_peminjaman.start": { $lt: jam_peminjaman.end },
          "jam_peminjaman.end": { $gt: jam_peminjaman.start },
        },
      ],
    });

    if (isRoomAvailable) {
      return res.status(400).json({
        message: "Ruangan tidak tersedia pada waktu yang diminta.",
      });
    }

    next();
  } catch (err) {
    console.error("Error checking room availability:", err);
    res.status(500).json({
      message: "Gagal memeriksa ketersediaan ruangan.",
    });
  }
};

export default { verifyToken, checkDuplicateUsername , isAdmin, checkRoomAvailability};
