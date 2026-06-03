import mongoose from "mongoose";
import { env } from "../env";

let connectionPromise: Promise<typeof mongoose> | null = null;

export function connectMongo() {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI precisa estar configurado.");
  }

  if (!connectionPromise) {
    mongoose.set("strictQuery", true);
    connectionPromise = mongoose.connect(env.mongodbUri);
  }

  return connectionPromise;
}
