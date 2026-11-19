import {
  getTransportState,
  getCurrentTimeStr,
  RouteStatus,
  StudentStatus,
  NotificationCategory,
  Stop,
  RouteItem,
  Student,
  NotificationItem,
} from "@/lib/data-store";

const validStatuses: RouteStatus[] = ["Scheduled", "On the way", "At stop", "Completed", "Delayed"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("routeId") || "RTE-008";
  const state = getTransportState();

  const selectedRoute = state.routes.find((r) => r.id === routeId) || state.routes[0];
  const pickedUpStudents = state.students
    .filter((s) => s.status === "Picked up")
    .map((s) => s.name);

  return Response.json({
    routeId: selectedRoute.id,
    status: selectedRoute.status,
    pickedUp: pickedUpStudents,
    activity: state.activity,
    routes: state.routes,
    students: state.students,
    notifications: state.notifications,
    unreadNotificationsCount: state.notifications.filter((n) => !n.read).length,
    selectedRoute,
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Provide a valid request body." }, { status: 400 });
  }

  const state = getTransportState();
  const time = getCurrentTimeStr();
  const routeId = typeof body.routeId === "string" ? body.routeId : "RTE-008";
  const targetRoute = state.routes.find((r) => r.id === routeId) || state.routes[0];

  // 1. Direct status update (backward compatibility)
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !validStatuses.includes(body.status as RouteStatus)) {
      return Response.json({ error: "Choose a valid route status." }, { status: 422 });
    }
    const nextStatus = body.status as RouteStatus;
    targetRoute.status = nextStatus;

    const messages: Record<RouteStatus, string> = {
      Scheduled: `${targetRoute.number} has been scheduled for departure`,
      "On the way": `${targetRoute.number} is on the way`,
      "At stop": `${targetRoute.number} arrived at current stop`,
      Completed: `${targetRoute.number} arrived at ${targetRoute.campus}`,
      Delayed: `A delay was reported on ${targetRoute.number}`,
    };

    const reason = typeof body.reason === "string" ? body.reason : "";
    const delayMinutes = typeof body.delayMinutes === "string" || typeof body.delayMinutes === "number" ? body.delayMinutes : 10;

    const event = {
      id: `ACT-${Date.now()}`,
      icon: nextStatus === "Delayed" ? "!" : "↗",
      title: messages[nextStatus],
      detail: reason ? `${reason} · approx ${delayMinutes} min` : `${targetRoute.campus} · Live update`,
      time,
      tone: (nextStatus === "Delayed" ? "amber" : "blue") as "amber" | "blue",
      routeId: targetRoute.id,
    };
    state.activity.unshift(event);

    if (nextStatus === "Delayed") {
      state.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        title: `${targetRoute.number} Delay Notice`,
        message: reason ? `Delay reported: ${reason} (${delayMinutes} mins)` : `Delay reported on ${targetRoute.number}`,
        category: "delay",
        routeId: targetRoute.id,
        audience: `${targetRoute.number} Families & Staff`,
        time,
        read: false,
        tone: "amber",
      });
    }

    return Response.json({
      success: true,
      routeId: targetRoute.id,
      status: targetRoute.status,
      activity: event,
      routes: state.routes,
      notifications: state.notifications,
    });
  }

  // 2. Direct pickedUp student name (backward compatibility)
  if (body.pickedUp !== undefined) {
    const studentName = String(body.pickedUp).trim();
    if (!studentName) {
      return Response.json({ error: "Student name is required." }, { status: 422 });
    }

    // Find student in roster or route
    const student = state.students.find((s) => s.name.toLowerCase() === studentName.toLowerCase());
    if (student) {
      student.status = "Picked up";
      student.pickupTime = time;
    }

    // Update stop status if matching
    const stop = targetRoute.stops.find((s) => s.student?.toLowerCase() === studentName.toLowerCase());
    if (stop) {
      stop.status = "done";
    }

    const event = {
      id: `ACT-${Date.now()}`,
      icon: "✓",
      title: `${studentName} was picked up`,
      detail: stop ? `${stop.name} · ${targetRoute.number}` : `${targetRoute.number} · Student boarding verified`,
      time,
      tone: "green" as const,
      routeId: targetRoute.id,
    };
    state.activity.unshift(event);

    state.notifications.unshift({
      id: `NOTIF-${Date.now()}`,
      title: `${studentName} Boarded School Bus`,
      message: `${studentName} has safely boarded ${targetRoute.number} at ${time}.`,
      category: "pickup",
      routeId: targetRoute.id,
      audience: `${studentName.split(" ")[0]} Family`,
      time,
      read: false,
      tone: "green",
    });

    return Response.json({
      success: true,
      routeId: targetRoute.id,
      pickedUp: state.students.filter((s) => s.status === "Picked up").map((s) => s.name),
      activity: event,
      students: state.students,
      routes: state.routes,
    });
  }

  // 3. Action-based dispatch
  const action = body.action;

  // Add a new stop to a route
  if (action === "add_stop") {
    const name = typeof body.name === "string" ? body.name : "";
    const area = typeof body.area === "string" ? body.area : "";
    const scheduledTime = typeof body.scheduledTime === "string" ? body.scheduledTime : "";
    const studentName = typeof body.studentName === "string" ? body.studentName : "";
    const grade = typeof body.grade === "string" ? body.grade : "Grade 4";
    const guardianName = typeof body.guardianName === "string" ? body.guardianName : "Parent";
    const guardianPhone = typeof body.guardianPhone === "string" ? body.guardianPhone : "+91 98000 00000";
    const emergencyContact = typeof body.emergencyContact === "string" ? body.emergencyContact : "+91 98000 00001";
    if (!name || !area || !scheduledTime) {
      return Response.json({ error: "Stop name, area, and time are required." }, { status: 422 });
    }

    const newStop: Stop = {
      id: `ST-${Date.now()}`,
      name,
      area,
      time: scheduledTime,
      status: "upcoming",
      student: studentName || undefined,
    };

    targetRoute.stops.push(newStop);

    if (studentName) {
      state.students.push({
        id: `STU-${Date.now()}`,
        name: studentName,
        grade,
        routeId: targetRoute.id,
        stopName: name,
        status: "Waiting",
        guardian: {
          name: guardianName,
          phone: guardianPhone,
          relation: "Guardian",
        },
        emergencyContact,
      });
    }

    return Response.json({ success: true, route: targetRoute, routes: state.routes }, { status: 201 });
  }

  // Create a new route
  if (action === "add_route") {
    const number = typeof body.number === "string" ? body.number : "";
    const campus = typeof body.campus === "string" ? body.campus : "";
    const driverName = typeof body.driverName === "string" ? body.driverName : "";
    const driverPhone = typeof body.driverPhone === "string" ? body.driverPhone : "+91 98765 00000";
    const vehicleReg = typeof body.vehicleReg === "string" ? body.vehicleReg : "";
    const vehicleModel = typeof body.vehicleModel === "string" ? body.vehicleModel : "Standard Bus";
    const capacity = typeof body.capacity === "number" || typeof body.capacity === "string" ? Number(body.capacity) : 30;
    if (!number || !campus || !driverName || !vehicleReg) {
      return Response.json({ error: "Route number, campus, driver name, and vehicle reg are required." }, { status: 422 });
    }

    const newRouteId = `RTE-${String(Math.floor(100 + Math.random() * 900))}`;
    const newRoute: RouteItem = {
      id: newRouteId,
      number,
      campus,
      status: "Scheduled",
      driver: {
        name: driverName,
        phone: driverPhone,
        avatar: driverName.split(" ").map((p: string) => p[0]).join("").toUpperCase().slice(0, 2),
        verified: true,
      },
      vehicle: {
        reg: vehicleReg,
        model: vehicleModel,
        capacity: Number(capacity) || 30,
        inspectionStatus: "Passed",
      },
      eta: "Scheduled departure",
      currentStopIndex: 0,
      stops: [
        { id: `ST-${Date.now()}-1`, name: "Depot Departure", area: "North Terminal", time: "7:15 AM", status: "upcoming" },
        { id: `ST-${Date.now()}-2`, name: "Pinecrest School", area: "Main Entrance", time: "8:00 AM", status: "upcoming" },
      ],
    };

    state.routes.push(newRoute);
    return Response.json({ success: true, route: newRoute, routes: state.routes }, { status: 201 });
  }

  // Add / Register new student
  if (action === "add_student") {
    const name = typeof body.name === "string" ? body.name : "";
    const grade = typeof body.grade === "string" ? body.grade : "";
    const assignedRouteId = typeof body.routeId === "string" ? body.routeId : "";
    const stopName = typeof body.stopName === "string" ? body.stopName : "";
    const guardianName = typeof body.guardianName === "string" ? body.guardianName : "";
    const guardianPhone = typeof body.guardianPhone === "string" ? body.guardianPhone : "";
    const emergencyContact = typeof body.emergencyContact === "string" ? body.emergencyContact : guardianPhone;
    const notes = typeof body.notes === "string" ? body.notes : undefined;
    if (!name || !grade || !assignedRouteId || !stopName || !guardianName || !guardianPhone) {
      return Response.json({ error: "Please fill in all student and guardian fields." }, { status: 422 });
    }

    const newStudent: Student = {
      id: `STU-${Date.now()}`,
      name,
      grade,
      routeId: assignedRouteId,
      stopName,
      status: "Waiting",
      guardian: {
        name: guardianName,
        phone: guardianPhone,
        relation: "Parent",
      },
      emergencyContact,
      notes,
    };

    state.students.push(newStudent);

    return Response.json({ success: true, student: newStudent, students: state.students }, { status: 201 });
  }

  // Update student status (e.g., Absent, Dropped off, Waiting)
  if (action === "update_student_status") {
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const newStatus = typeof body.status === "string" ? (body.status as StudentStatus) : "Waiting";
    const student = state.students.find((s) => s.id === studentId);
    if (!student) {
      return Response.json({ error: "Student not found." }, { status: 404 });
    }

    student.status = newStatus;
    if (newStatus === "Picked up") {
      student.pickupTime = time;
    }

    const event = {
      id: `ACT-${Date.now()}`,
      icon: newStatus === "Absent" ? "!" : newStatus === "Picked up" ? "✓" : "↗",
      title: `${student.name} marked as ${newStatus}`,
      detail: `${student.stopName} · Grade ${student.grade}`,
      time,
      tone: (newStatus === "Absent" ? "amber" : newStatus === "Picked up" ? "green" : "blue") as "amber" | "green" | "blue",
    };
    state.activity.unshift(event);

    return Response.json({ success: true, student, students: state.students, activity: state.activity });
  }

  // Broadcast announcement / notification
  if (action === "broadcast_notification") {
    const title = typeof body.title === "string" ? body.title : "";
    const message = typeof body.message === "string" ? body.message : "";
    const category = typeof body.category === "string" ? body.category : "announcement";
    const audience = typeof body.audience === "string" ? body.audience : "All Families & Staff";
    const tone = typeof body.tone === "string" ? body.tone : "blue";
    const notifRouteId = typeof body.routeId === "string" ? body.routeId : undefined;
    if (!title || !message) {
      return Response.json({ error: "Title and message are required." }, { status: 422 });
    }

    const notif: NotificationItem = {
      id: `NOTIF-${Date.now()}`,
      title,
      message,
      category: (category as NotificationCategory) || "announcement",
      audience,
      time,
      read: false,
      tone: (tone as "green" | "blue" | "amber" | "rose") || "blue",
      routeId: notifRouteId,
    };

    state.notifications.unshift(notif);
    state.activity.unshift({
      id: `ACT-${Date.now()}`,
      icon: tone === "amber" ? "!" : "↗",
      title,
      detail: `${audience} · Broadcast`,
      time,
      tone: tone === "amber" ? "amber" : "blue",
    });

    return Response.json({ success: true, notification: notif, notifications: state.notifications }, { status: 201 });
  }

  // Mark notifications as read
  if (action === "mark_notifications_read") {
    const notifId = typeof body.id === "string" ? body.id : undefined;
    if (notifId) {
      const target = state.notifications.find((n) => n.id === notifId);
      if (target) target.read = true;
    } else {
      state.notifications.forEach((n) => { n.read = true; });
    }
    return Response.json({ success: true, notifications: state.notifications });
  }

  // Advance route stop (simulation)
  if (action === "advance_stop") {
    const rIndex = state.routes.findIndex((r) => r.id === routeId);
    if (rIndex >= 0) {
      const r = state.routes[rIndex];
      const nextIndex = r.currentStopIndex + 1;
      if (nextIndex < r.stops.length) {
        r.stops[r.currentStopIndex].status = "done";
        r.stops[nextIndex].status = "current";
        r.currentStopIndex = nextIndex;

        // Auto mark student picked up if at this stop
        const currentStop = r.stops[nextIndex];
        if (currentStop.student) {
          const st = state.students.find((s) => s.name === currentStop.student);
          if (st) {
            st.status = "Picked up";
            st.pickupTime = time;
          }
        }

        const event = {
          id: `ACT-${Date.now()}`,
          icon: "↗",
          title: `${r.number} reached ${currentStop.name}`,
          detail: `${currentStop.area} · Stop ${nextIndex + 1} of ${r.stops.length}`,
          time,
          tone: "blue" as const,
          routeId: r.id,
        };
        state.activity.unshift(event);
      } else {
        r.status = "Completed";
        r.stops.forEach((s) => { s.status = "done"; });
        state.activity.unshift({
          id: `ACT-${Date.now()}`,
          icon: "✓",
          title: `${r.number} completed morning route`,
          detail: `All students safely arrived at ${r.campus}`,
          time,
          tone: "green",
          routeId: r.id,
        });
      }
    }
    return Response.json({ success: true, routes: state.routes, students: state.students, activity: state.activity });
  }

  return Response.json({ error: "Unknown action provided." }, { status: 400 });
}
