import mongoose from "mongoose";
import app from "./app.js";
import { env } from "./config/env.js";
mongoose
  .connect(env.mongoUri)
  .then(() =>
    app.listen(env.port, () => console.log(`KRA API listening on ${env.port}`)),
  )
  .catch((error) => {
    console.error("MongoDB connection failed", error);
    process.exit(1);
  });
