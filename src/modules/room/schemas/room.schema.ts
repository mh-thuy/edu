import { z } from "zod";

export const roomCreateSchema = z.object({
  code: z.string().min(1, "Room code is required").max(50),
  name: z.string().min(1, "Room name is required").max(100),
  capacity: z.number().min(1, "Capacity must be at least 1").int(),
  floor: z.number().int().default(1),
  location: z.string().optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]).default("AVAILABLE"),
  note: z.string().optional(),
});

export const roomUpdateSchema = roomCreateSchema.partial();

export const roomFilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export type RoomCreate = z.infer<typeof roomCreateSchema>;
export type RoomUpdate = z.infer<typeof roomUpdateSchema>;
export type RoomFilter = z.infer<typeof roomFilterSchema>;
