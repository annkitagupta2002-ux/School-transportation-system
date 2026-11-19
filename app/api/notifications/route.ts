import { getTransportState, getCurrentTimeStr, NotificationItem, NotificationCategory } from "@/lib/data-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const state = getTransportState();
  let notifications = [...state.notifications];

  if (category && category !== "all") {
    notifications = notifications.filter((n) => n.category === category);
  }

  if (unreadOnly) {
    notifications = notifications.filter((n) => !n.read);
  }

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  return Response.json({
    notifications,
    unreadCount,
    total: state.notifications.length,
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

  // Mark all or single notification as read
  if (body.action === "mark_read") {
    if (typeof body.id === "string") {
      const notif = state.notifications.find((n) => n.id === body.id);
      if (notif) notif.read = true;
    } else {
      state.notifications.forEach((n) => { n.read = true; });
    }
    return Response.json({
      success: true,
      unreadCount: state.notifications.filter((n) => !n.read).length,
      notifications: state.notifications,
    });
  }

  // Broadcast new notification
  const title = typeof body.title === "string" ? body.title : "";
  const message = typeof body.message === "string" ? body.message : "";
  const category = typeof body.category === "string" ? body.category : "";
  const audience = typeof body.audience === "string" ? body.audience : "";
  const tone = typeof body.tone === "string" ? body.tone : "";
  const routeId = typeof body.routeId === "string" ? body.routeId : undefined;
  if (!title || !message) {
    return Response.json({ error: "Title and message are required." }, { status: 422 });
  }

  const newNotification: NotificationItem = {
    id: `NOTIF-${Date.now()}`,
    title: title.trim(),
    message: message.trim(),
    category: (category as NotificationCategory) || "announcement",
    audience: audience?.trim() || "All Families & Staff",
    time,
    read: false,
    tone: (tone as "green" | "blue" | "amber" | "rose") || "blue",
    routeId: routeId || undefined,
  };

  state.notifications.unshift(newNotification);

  state.activity.unshift({
    id: `ACT-${Date.now()}`,
    icon: newNotification.tone === "amber" ? "!" : "↗",
    title: newNotification.title,
    detail: `${newNotification.audience} · Live alert`,
    time,
    tone: newNotification.tone === "amber" ? "amber" : "blue",
    routeId,
  });

  return Response.json({
    success: true,
    notification: newNotification,
    notifications: state.notifications,
    unreadCount: state.notifications.filter((n) => !n.read).length,
  }, { status: 201 });
}
