import { getTransportState, getCurrentTimeStr, Student, StudentStatus } from "@/lib/data-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("routeId");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.toLowerCase().trim();

  const state = getTransportState();
  let students = [...state.students];

  if (routeId && routeId !== "all") {
    students = students.filter((s) => s.routeId === routeId);
  }

  if (status && status !== "all") {
    students = students.filter((s) => s.status.toLowerCase() === status.toLowerCase());
  }

  if (search) {
    students = students.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.stopName.toLowerCase().includes(search) ||
        s.guardian.name.toLowerCase().includes(search) ||
        s.grade.toLowerCase().includes(search)
    );
  }

  const counts = {
    total: state.students.length,
    pickedUp: state.students.filter((s) => s.status === "Picked up").length,
    waiting: state.students.filter((s) => s.status === "Waiting").length,
    droppedOff: state.students.filter((s) => s.status === "Dropped off").length,
    absent: state.students.filter((s) => s.status === "Absent").length,
  };

  return Response.json({
    students,
    counts,
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
  const time = getCurrentTimeStr();

  // Update existing student status
  if (body.action === "update_status" || (body.studentId && body.status)) {
    const studentId = typeof body.studentId === "string" ? body.studentId : typeof body.id === "string" ? body.id : "";
    const student = state.students.find((s) => s.id === studentId);
    if (!student) {
      return Response.json({ error: "Student not found." }, { status: 404 });
    }

    const newStatus = body.status as StudentStatus;
    student.status = newStatus;
    if (newStatus === "Picked up") {
      student.pickupTime = time;
    }

    state.activity.unshift({
      id: `ACT-${Date.now()}`,
      icon: newStatus === "Picked up" ? "✓" : newStatus === "Absent" ? "!" : "↗",
      title: `${student.name} marked as ${newStatus}`,
      detail: `${student.stopName} · Grade ${student.grade}`,
      time,
      tone: newStatus === "Picked up" ? "green" : newStatus === "Absent" ? "amber" : "blue",
    });

    return Response.json({
      success: true,
      student,
      students: state.students,
    });
  }

  // Create new student
  const name = typeof body.name === "string" ? body.name : "";
  const grade = typeof body.grade === "string" ? body.grade : "";
  const routeId = typeof body.routeId === "string" ? body.routeId : "";
  const stopName = typeof body.stopName === "string" ? body.stopName : "";
  const guardianName = typeof body.guardianName === "string" ? body.guardianName : "";
  const guardianPhone = typeof body.guardianPhone === "string" ? body.guardianPhone : "";
  const emergencyContact = typeof body.emergencyContact === "string" ? body.emergencyContact : "";
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const guardianRelation = typeof body.guardianRelation === "string" ? body.guardianRelation : "Parent";

  if (!name || !grade || !routeId || !stopName || !guardianName || !guardianPhone) {
    return Response.json(
      { error: "Validation failed: name, grade, routeId, stopName, guardianName, and guardianPhone are required." },
      { status: 422 }
    );
  }

  const newStudent: Student = {
    id: `STU-${String(state.students.length + 1).padStart(3, "0")}`,
    name: name.trim(),
    grade: grade.trim(),
    routeId,
    stopName: stopName.trim(),
    status: "Waiting",
    guardian: {
      name: guardianName.trim(),
      phone: guardianPhone.trim(),
      relation: guardianRelation,
    },
    emergencyContact: (emergencyContact || guardianPhone).trim(),
    notes: notes?.trim() || undefined,
  };

  state.students.push(newStudent);

  state.activity.unshift({
    id: `ACT-${Date.now()}`,
    icon: "✓",
    title: `Registered new student: ${newStudent.name}`,
    detail: `Assigned to ${routeId} at ${newStudent.stopName}`,
    time,
    tone: "blue",
  });

  return Response.json({ success: true, student: newStudent, students: state.students }, { status: 201 });
}
