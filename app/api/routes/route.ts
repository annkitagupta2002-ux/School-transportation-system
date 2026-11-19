import { getTransportState, RouteItem, Stop } from "@/lib/data-store";

export async function GET() {
  const state = getTransportState();
  return Response.json({
    routes: state.routes,
    totalRoutes: state.routes.length,
    activeRoutes: state.routes.filter((r) => r.status === "On the way" || r.status === "At stop").length,
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  const state = getTransportState();

  if (body.action === "add_stop") {
    const routeId = typeof body.routeId === "string" ? body.routeId : "";
    const name = typeof body.name === "string" ? body.name : "";
    const area = typeof body.area === "string" ? body.area : "";
    const stopTime = typeof body.time === "string" ? body.time : "";
    const student = typeof body.student === "string" ? body.student : "";
    const targetRoute = state.routes.find((r) => r.id === routeId);
    if (!targetRoute) {
      return Response.json({ error: "Route not found." }, { status: 404 });
    }
    if (!name || !area || !stopTime) {
      return Response.json({ error: "Stop name, area, and scheduled time are required." }, { status: 422 });
    }

    const newStop: Stop = {
      id: `ST-${Date.now()}`,
      name: name.trim(),
      area: area.trim(),
      time: stopTime.trim(),
      status: "upcoming",
      student: student ? student.trim() : undefined,
    };

    targetRoute.stops.push(newStop);
    return Response.json({ success: true, stop: newStop, route: targetRoute }, { status: 201 });
  }

  // Create route
  const number = typeof body.number === "string" ? body.number : "";
  const campus = typeof body.campus === "string" ? body.campus : "";
  const driverName = typeof body.driverName === "string" ? body.driverName : "";
  const driverPhone = typeof body.driverPhone === "string" ? body.driverPhone : "";
  const vehicleReg = typeof body.vehicleReg === "string" ? body.vehicleReg : "";
  const vehicleModel = typeof body.vehicleModel === "string" ? body.vehicleModel : "";
  const capacity = typeof body.capacity === "number" || typeof body.capacity === "string" ? Number(body.capacity) : 32;
  if (!number || !campus || !driverName || !vehicleReg) {
    return Response.json(
      { error: "Validation failed: route number, campus, driver name, and vehicle registration are required." },
      { status: 422 }
    );
  }

  const newRoute: RouteItem = {
    id: `RTE-${String(Math.floor(100 + Math.random() * 900))}`,
    number: number.trim(),
    campus: campus.trim(),
    status: "Scheduled",
    driver: {
      name: driverName.trim(),
      phone: (driverPhone || "+91 98000 00000").trim(),
      avatar: driverName.trim().slice(0, 2).toUpperCase(),
      verified: true,
    },
    vehicle: {
      reg: vehicleReg.trim().toUpperCase(),
      model: vehicleModel?.trim() || "School Bus 32-Seater",
      capacity: Number(capacity) || 32,
      inspectionStatus: "Passed",
    },
    eta: "Scheduled departure",
    currentStopIndex: 0,
    stops: [
      { id: `ST-${Date.now()}-1`, name: "Depot Departure", area: "Terminal 1", time: "7:00 AM", status: "upcoming" },
      { id: `ST-${Date.now()}-2`, name: "Pinecrest School", area: "Main Entrance", time: "7:45 AM", status: "upcoming" },
    ],
  };

  state.routes.push(newRoute);
  return Response.json({ success: true, route: newRoute, routes: state.routes }, { status: 201 });
}
