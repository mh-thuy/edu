import { requireAuth } from "@/lib/auth";
import { RoomList } from "@/modules/room/components/RoomList";
import type { ReactElement } from "react";


export default async function RoomsPage(): Promise<ReactElement> {
  await requireAuth();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Room Management</h1>
      <RoomList />
    </div>
  );
}
