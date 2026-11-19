type RouteStatus = "Scheduled" | "On the way" | "At stop" | "Completed" | "Delayed";

const validStatuses: RouteStatus[] = ["Scheduled", "On the way", "At stop", "Completed", "Delayed"];
const routeState = globalThis as typeof globalThis & {
  waypointRouteState?: { status: RouteStatus; pickedUp: string[]; activity: { title: string; time: string }[] };
};

function getState() {
  routeState.waypointRouteState ??= {
    status: "On the way",
    pickedUp: ["Aarav Mehta", "Anaya Sharma"],
    activity: [],
  };
  return routeState.waypointRouteState;
}

export async function GET() {
  const state = getState();
  return Response.json({ routeId: "RTE-008", status: state.status, pickedUp: state.pickedUp, activity: state.activity });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Provide a route update." }, { status: 400 });
  }

  const input = body as { status?: unknown; pickedUp?: unknown };
  const state = getState();
  const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !validStatuses.includes(input.status as RouteStatus)) {
      return Response.json({ error: "Choose a valid route status." }, { status: 422 });
    }
    state.status = input.status as RouteStatus;
    const labels: Record<RouteStatus, string> = {
      Scheduled: "Route 08 has been scheduled",
      "On the way": "Bus 08 is on the way",
      "At stop": "Bus 08 has arrived at Rosewood Society",
      Completed: "Route 08 has arrived at Pinecrest School",
      Delayed: "A delay was reported on Route 08",
    };
    state.activity.unshift({ title: labels[state.status], time });
    return Response.json({ routeId: "RTE-008", status: state.status, activity: state.activity[0] });
  }

  if (typeof input.pickedUp !== "string" || !["Ishaan Kapoor", "Mira Patel"].includes(input.pickedUp)) {
    return Response.json({ error: "Choose a student on Route 08." }, { status: 422 });
  }
  if (state.pickedUp.includes(input.pickedUp)) {
    return Response.json({ error: "This student is already marked as picked up." }, { status: 409 });
  }
  state.pickedUp.push(input.pickedUp);
  const event = { title: `${input.pickedUp} was picked up`, time };
  state.activity.unshift(event);
  return Response.json({ routeId: "RTE-008", pickedUp: state.pickedUp, activity: event });
}
