"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import type {
  RouteItem,
  RouteStatus,
  Student,
  StudentStatus,
  NotificationItem,
  ActivityEvent,
} from "@/lib/data-store";
import { readApiJson } from "@/lib/api-response";

type Tab = "overview" | "live" | "routes" | "students" | "notifications";
type DriverAccount = { id: string; name: string; email: string; isActive: boolean; routes: { id: string; number: string }[] };

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<string, ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-7h6v7" />
      </>
    ),
    bus: (
      <>
        <path d="M5 17h14l1-3V6c0-1.1-.9-2-2-2H6C4.9 4 4 4.9 4 6v8l1 3Z" />
        <path d="M4 11h16M8 20v-3m8 3v-3M7 8h.01M17 8h.01" />
        <circle cx="7.5" cy="14" r="1" />
        <circle cx="16.5" cy="14" r="1" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path d="M8 18h2a4 4 0 0 0 4-4V10a4 4 0 0 1 4-4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4m0 4h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </>
    ),
    plus: <path d="M12 5v14m-7-7h14" />,
    phone: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] ?? paths.pin}</svg>;
}

function formatNotificationAge(createdAt: string | undefined, fallbackTime: string, now: Date | null) {
  if (!createdAt) return fallbackTime;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return fallbackTime;
  const elapsedMinutes = Math.max(0, Math.floor(((now?.getTime() ?? Date.now()) - created.getTime()) / 60_000));
  const age = elapsedMinutes < 1
    ? "just now"
    : elapsedMinutes < 60
      ? `${elapsedMinutes}m ago`
      : elapsedMinutes < 24 * 60
        ? `${Math.floor(elapsedMinutes / 60)}h ago`
        : `${Math.floor(elapsedMinutes / (24 * 60))}d ago`;
  const time = created.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${time} · ${age}`;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [role, setRole] = useState("School admin");
  const [token, setToken] = useState("");
  const [authChecking, setAuthChecking] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [authUser, setAuthUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [authError, setAuthError] = useState("");
  const [registerParent, setRegisterParent] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);
  const [drivers, setDrivers] = useState<DriverAccount[]>([]);
  const [showDriversModal, setShowDriversModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverAccount | null>(null);
  const [driverFormError, setDriverFormError] = useState("");
  const [driverFormSuccess, setDriverFormSuccess] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const updateClock = () => setCurrentDateTime(new Date());
    updateClock();
    const intervalId = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("waypoint-token");
    const headers = new Headers();
    if (saved) headers.set("Authorization", `Bearer ${saved}`);
    fetch("/api/auth/me", { headers, credentials: "include" })
      .then(async (r) => { if (!r.ok) throw new Error("No active session."); return readApiJson<{ user: { id: string; name: string; email: string; role: string } }>(r); })
      .then((data) => {
        setToken("authenticated");
        setAuthUser(data.user);
        const nextRole = data.user.role === "SCHOOL_ADMIN" ? "School admin" : data.user.role === "DRIVER" ? "Driver" : "Parent";
        setRole(nextRole);
        if (nextRole === "Parent") setActiveTab("live");
        localStorage.removeItem("waypoint-token");
      })
      .catch(() => { localStorage.removeItem("waypoint-token"); setToken(""); })
      .finally(() => setAuthChecking(false));
  }, []);

  const apiFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    setPendingRequests((count) => count + 1);
    try { return await fetch(input, { cache: "no-store", ...init, headers, credentials: "include" }); }
    finally { setPendingRequests((count) => Math.max(0, count - 1)); }
  }, []);

  const loadDrivers = useCallback(async () => {
    const response = await apiFetch("/api/drivers");
    const data = await readApiJson<{ drivers?: DriverAccount[]; error?: string }>(response);
    if (!response.ok) throw new Error(data.error || "Could not load driver accounts.");
    const nextDrivers = Array.isArray(data.drivers) ? data.drivers : [];
    setDrivers(nextDrivers);
    return nextDrivers;
  }, [apiFetch]);

  function flashNotice(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3500);
  }

  async function handleAuthSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setAuthError(""); setAuthSubmitting(true);
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    const endpoint = registerParent ? "/api/auth/register-parent" : "/api/auth/login";
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await readApiJson<{ error?: string; user: { id: string; name: string; email: string; role: string } }>(response);
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      localStorage.removeItem("waypoint-token"); setToken("authenticated"); setAuthUser(data.user);
      const nextRole = data.user.role === "SCHOOL_ADMIN" ? "School admin" : data.user.role === "DRIVER" ? "Driver" : "Parent";
      setRole(nextRole);
      if (nextRole === "Parent") setActiveTab("live");
    } catch (err) { setAuthError(err instanceof Error ? err.message : "Could not sign in."); }
    finally { setAuthSubmitting(false); }
  }

  async function handleDriverSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDriverFormError("");
    setDriverFormSuccess("");
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const payload = { ...values, isActive: values.isActive === "on", routeId: values.routeId || "" };
    try {
      const response = await apiFetch(editingDriver ? `/api/drivers/${editingDriver.id}` : "/api/drivers", {
        method: editingDriver ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      const data = await readApiJson<{ error?: string; driver?: { id: string; name: string; email: string; isActive: boolean } }>(response);
      if (!response.ok) throw new Error(data.error || "Could not save driver account.");
      if (!data.driver) throw new Error("The server did not confirm the saved driver account.");
      const savedDriver = { ...data.driver, routes: editingDriver?.routes || [] };
      setDrivers((current) => editingDriver
        ? current.map((driver) => driver.id === savedDriver.id ? { ...driver, ...savedDriver } : driver)
        : [...current.filter((driver) => driver.id !== savedDriver.id), savedDriver]);
      let listRefreshError = "";
      try {
        await loadDrivers();
      } catch {
        listRefreshError = "The account was saved, but the driver list could not refresh. Reopen this form to retry.";
      }
      setEditingDriver(null);
      form.reset();
      if (listRefreshError) setDriverFormError(listRefreshError);
      else setDriverFormSuccess(`Driver account saved for ${savedDriver.email}. Sign in using this email and the password entered above.`);
    } catch (err) {
      setDriverFormError(err instanceof Error ? err.message : "Could not save driver account.");
    }
  }

  async function handleDeactivateDriver(driver: DriverAccount) {
    if (!window.confirm(`Deactivate ${driver.name}'s account? They will no longer be able to sign in.`)) return;
    try {
      const response = await apiFetch(`/api/drivers/${driver.id}`, { method: "DELETE" });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Could not deactivate driver.");
      await loadDrivers();
      flashNotice("Driver account deactivated");
    } catch (err) { flashNotice(err instanceof Error ? err.message : "Could not deactivate driver."); }
  }

  async function handleSignOut() {
    try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch { /* Clear the local session even if the API is offline. */ }
    localStorage.removeItem("waypoint-token");
    setToken(""); setAuthUser(null); setRole("School admin");
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const response = await apiFetch("/api/auth/me", { method: "PATCH", body: JSON.stringify(values) });
      const data = await readApiJson<{ user?: { id: string; name: string; email: string; role: string }; error?: string }>(response);
      if (!response.ok || !data.user) throw new Error(data.error || "Could not update your profile.");
      setAuthUser(data.user);
      setShowProfileModal(false);
      flashNotice("Profile updated");
    } catch (err) { flashNotice(err instanceof Error ? err.message : "Could not update your profile."); }
  }

  async function handleReactivateDriver(driver: DriverAccount) {
    try {
      const response = await apiFetch(`/api/drivers/${driver.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Could not reactivate driver.");
      await loadDrivers();
      flashNotice("Driver account reactivated");
    } catch (err) { flashNotice(err instanceof Error ? err.message : "Could not reactivate driver."); }
  }

  // Modals state
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [activeContactStudent, setActiveContactStudent] = useState<Student | null>(null);

  // Filters state
  const [studentSearch, setStudentSearch] = useState("");
  const [studentRouteFilter, setStudentRouteFilter] = useState("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");
  const [notifCategoryFilter, setNotifCategoryFilter] = useState("all");

  // Load all initial data from backend API
  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/route?routeId=${selectedRouteId}`);
      if (!res.ok) throw new Error("Could not load transportation data.");
      const data = await readApiJson<{ routes?: RouteItem[]; students?: Student[]; notifications?: NotificationItem[]; activity?: ActivityEvent[]; unreadNotificationsCount?: number }>(res);
      if (Array.isArray(data.routes)) {
        setRoutes(data.routes);
        if (data.routes.length && !data.routes.some((route) => route.id === selectedRouteId)) setSelectedRouteId(data.routes[0].id);
      }
      if (Array.isArray(data.students)) setStudents(data.students);
      if (Array.isArray(data.notifications)) setNotifications(data.notifications);
      if (Array.isArray(data.activity)) setActivity(data.activity);
      if (typeof data.unreadNotificationsCount === "number") {
        setUnreadCount(data.unreadNotificationsCount);
      }
    } catch (err) {
      console.error(err);
      setNotice(err instanceof Error ? err.message : "Error connecting to transport service.");
    }
  }, [selectedRouteId, apiFetch]);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;
    const loadTransportationData = () => apiFetch(`/api/route?routeId=${selectedRouteId}`)
      .then((res) => { if (!res.ok) throw new Error("Could not load transportation data."); return readApiJson<{ routes?: RouteItem[]; students?: Student[]; notifications?: NotificationItem[]; activity?: ActivityEvent[]; unreadNotificationsCount?: number }>(res); })
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data.routes)) {
          setRoutes(data.routes);
          if (data.routes.length && !data.routes.some((route) => route.id === selectedRouteId)) setSelectedRouteId(data.routes[0].id);
        }
        if (Array.isArray(data.students)) setStudents(data.students);
        if (Array.isArray(data.notifications)) setNotifications(data.notifications);
        if (Array.isArray(data.activity)) setActivity(data.activity);
        if (typeof data.unreadNotificationsCount === "number") {
          setUnreadCount(data.unreadNotificationsCount);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setNotice(err instanceof Error ? err.message : "Error connecting to transport service.");
        }
      });
    queueMicrotask(loadTransportationData);
    return () => {
      isMounted = false;
    };
  }, [selectedRouteId, token, apiFetch]);

  useEffect(() => {
    if (!token || role !== "School admin") return;
    let isMounted = true;
    const loadDrivers = () => apiFetch("/api/drivers")
      .then(async (response) => {
        const data = await readApiJson<{ drivers?: DriverAccount[]; error?: string }>(response);
        if (!response.ok) throw new Error(data.error || "Could not load driver accounts.");
        if (isMounted) setDrivers(Array.isArray(data.drivers) ? data.drivers : []);
      })
      .catch((err) => { if (isMounted) setNotice(err instanceof Error ? err.message : "Could not load driver accounts."); });
    queueMicrotask(loadDrivers);
    return () => { isMounted = false; };
  }, [token, role, apiFetch]);

  const currentRoute = routes.find((r) => r.id === selectedRouteId) || routes[0] || {
    id: "", number: "No route selected", campus: "", status: "Scheduled" as RouteStatus,
    driver: { name: "", phone: "", avatar: "", verified: false },
    vehicle: { reg: "", model: "", capacity: 0, inspectionStatus: "Pending" as const },
    eta: "", currentStopIndex: 0, stops: [],
  };

  // Action: update route status
  async function handleUpdateStatus(next: RouteStatus, reason?: string, delayMinutes?: string) {
    try {
      const res = await apiFetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: currentRoute.id,
          status: next,
          reason,
          delayMinutes,
        }),
      });
      const data = await readApiJson<{ error?: string; route?: RouteItem }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to update route.");
      await loadData();
      flashNotice(`${currentRoute.number} status set to "${next}" · shared with families`);
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Failed to update route status.");
    }
    setShowDelayModal(false);
  }

  // Action: Mark student picked up
  async function handleMarkPickedUp(studentName: string) {
    try {
      const res = await apiFetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: currentRoute.id,
          pickedUp: studentName,
        }),
      });
      const data = await readApiJson<{ error?: string; route?: RouteItem }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to record pickup.");
      await loadData();
      flashNotice(`${studentName} marked as picked up · family notified`);
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Error saving pickup.");
    }
  }

  // Action: Update student status (e.g. Absent / Dropped off)
  async function handleStudentStatusChange(studentId: string, status: StudentStatus) {
    try {
      const res = await apiFetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, status }),
      });
      const data = await readApiJson<{ error?: string; route?: RouteItem }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to update student.");
      await loadData();
      flashNotice(`Student status updated to ${status}`);
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Error updating student status.");
    }
  }

  // Action: Simulate advance route to next stop
  async function handleAdvanceStop(routeId: string) {
    try {
      const res = await apiFetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId, action: "advance_stop" }),
      });
      const data = await readApiJson<{ error?: string; route?: RouteItem }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to advance route.");
      await loadData();
      flashNotice("Bus progressed to the next stop · live ETAs updated");
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Error progressing route.");
    }
  }

  // Action: Mark all notifications read
  async function handleMarkAllNotificationsRead(id?: string) {
    try {
      const res = await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id }),
      });
      const data = await readApiJson<{ error?: string; route?: RouteItem }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to mark notifications.");
      await loadData();
      flashNotice("Notifications updated");
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Error updating notifications.");
    }
  }

  async function handleDeleteNotification(id: string) {
    if (!window.confirm("Delete this broadcast for everyone?")) return;
    try {
      const response = await apiFetch(`/api/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Could not delete broadcast.");
      await loadData();
      flashNotice("Broadcast deleted");
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Could not delete broadcast.");
    }
  }

  async function handleNotifyDriver(student: Student) {
    try {
      const response = await apiFetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "notify_driver", studentId: student.id }) });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Could not notify the assigned driver.");
      await loadData();
      flashNotice("Pickup message sent to the assigned driver");
    } catch (err) { flashNotice(err instanceof Error ? err.message : "Could not notify the assigned driver."); }
  }

  // Action: Add new stop
  async function handleAddStopSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = {
      action: "add_stop",
      routeId: selectedRouteId,
      name: formData.get("name"),
      area: formData.get("area"),
      time: formData.get("time"),
      student: formData.get("student"),
    };

    try {
      const res = await apiFetch(editingRoute ? `/api/routes/${editingRoute.id}` : "/api/routes", {
        method: editingRoute ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiJson<{ error?: string; route?: RouteItem }>(res);
      if (!res.ok) throw new Error(data.error || "Could not add stop.");
      await loadData();
      setShowAddStopModal(false);
      flashNotice("New stop added successfully to route");
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Error adding stop.");
    }
  }

  // Action: Add new route
  async function handleAddRouteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = {
      number: formData.get("number"),
      campus: formData.get("campus"),
      driverName: formData.get("driverName"),
      driverPhone: formData.get("driverPhone"),
      driverId: formData.get("driverId"),
      vehicleReg: formData.get("vehicleReg"),
      vehicleModel: formData.get("vehicleModel"),
      capacity: formData.get("capacity"),
    };

    try {
      const res = await apiFetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiJson<{ error?: string; route?: RouteItem }>(res);
      if (!res.ok) throw new Error(data.error || "Could not create route.");
      await loadData();
      await loadDrivers().catch(() => undefined);
      setShowAddRouteModal(false);
      if (data.route?.id) setSelectedRouteId(data.route.id);
      setEditingRoute(null);
      flashNotice(editingRoute ? `Route "${body.number}" updated` : `New route "${body.number}" created successfully`);
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Error creating route.");
    }
  }

  async function handleDeleteRoute(route: RouteItem) {
    if (!window.confirm(`Delete ${route.number}? Routes with assigned students must be reassigned first.`)) return;
    try {
      const response = await apiFetch(`/api/routes/${route.id}`, { method: "DELETE" });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Could not delete route.");
      await loadData();
      setSelectedRouteId("");
      flashNotice(`${route.number} deleted`);
    } catch (err) { flashNotice(err instanceof Error ? err.message : "Could not delete route."); }
  }

  async function handleEditStop(stop: RouteItem["stops"][number]) {
    const name = window.prompt("Stop name", stop.name);
    if (name === null) return;
    const area = window.prompt("Landmark / area", stop.area);
    if (area === null) return;
    const time = window.prompt("Scheduled time", stop.time);
    if (time === null) return;
    try {
      const response = await apiFetch(`/api/stops/${encodeURIComponent(stop.id)}`, { method: "PATCH", body: JSON.stringify({ routeId: currentRoute.id, name, area, time, student: stop.student }) });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Could not update stop.");
      await loadData();
      flashNotice("Stop updated");
    } catch (err) { flashNotice(err instanceof Error ? err.message : "Could not update stop."); }
  }

  async function handleDeleteStop(stop: RouteItem["stops"][number]) {
    if (!window.confirm(`Remove ${stop.name} from ${currentRoute.number}?`)) return;
    try {
      const response = await apiFetch(`/api/stops/${encodeURIComponent(stop.id)}?routeId=${encodeURIComponent(currentRoute.id)}`, { method: "DELETE" });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Could not remove stop.");
      await loadData();
      flashNotice("Stop removed");
    } catch (err) { flashNotice(err instanceof Error ? err.message : "Could not remove stop."); }
  }

  // Action: Add new student
  async function handleAddStudentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = {
      name: formData.get("name"),
      grade: formData.get("grade"),
      routeId: formData.get("routeId"),
      stopName: formData.get("stopName"),
      guardianName: formData.get("guardianName"),
      guardianPhone: formData.get("guardianPhone"),
      guardianRelation: formData.get("guardianRelation"),
      emergencyContact: formData.get("emergencyContact"),
      notes: formData.get("notes"),
    };

    try {
      const res = await apiFetch(editingStudent ? `/api/students/${editingStudent.id}` : "/api/students", {
        method: editingStudent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiJson<{ error?: string; route?: RouteItem }>(res);
      if (!res.ok) throw new Error(data.error || "Could not register student.");
      await loadData();
      setShowAddStudentModal(false);
      setEditingStudent(null);
      flashNotice(editingStudent ? `Student "${body.name}" updated` : `Student "${body.name}" registered and assigned to ${body.routeId}`);
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Error registering student.");
    }
  }

  async function handleDeleteStudent(student: Student) {
    if (!window.confirm(`Delete ${student.name}'s record? This removes the student record but keeps the parent account.`)) return;
    try {
      const response = await apiFetch(`/api/students/${student.id}`, { method: "DELETE" });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Could not delete student.");
      await loadData();
      flashNotice(`Student ${student.name} removed`);
    } catch (err) { flashNotice(err instanceof Error ? err.message : "Could not delete student."); }
  }

  // Action: Broadcast announcement
  async function handleBroadcastSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = {
      title: formData.get("title"),
      message: formData.get("message"),
      category: formData.get("category"),
      audience: formData.get("audience"),
      tone: formData.get("tone"),
      routeId: formData.get("routeId") || undefined,
    };

    try {
      const res = await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiJson<{ error?: string; route?: RouteItem }>(res);
      if (!res.ok) throw new Error(data.error || "Could not broadcast alert.");
      await loadData();
      setShowBroadcastModal(false);
      flashNotice("Broadcast announcement dispatched to all recipients");
    } catch (err) {
      flashNotice(err instanceof Error ? err.message : "Error sending broadcast.");
    }
  }

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchRoute = studentRouteFilter === "all" || s.routeId === studentRouteFilter;
    const matchStatus = studentStatusFilter === "all" || s.status.toLowerCase() === studentStatusFilter.toLowerCase();
    const matchQuery =
      !studentSearch.trim() ||
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.stopName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.guardian.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.grade.toLowerCase().includes(studentSearch.toLowerCase());
    return matchRoute && matchStatus && matchQuery;
  });

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (notifCategoryFilter === "all") return true;
    return n.category === notifCategoryFilter;
  });

  // Overview operational metrics
  const totalStudents = students.length;
  const parentStudent = role === "Parent" ? students[0] : undefined;
  const pickedUpCount = students.filter((s) => s.status === "Picked up").length;
  const waitingCount = students.filter((s) => s.status === "Waiting").length;
  const activeRoutesCount = routes.filter((r) => r.status === "On the way" || r.status === "At stop").length;
  const attentionRoutesCount = routes.filter((r) => r.status === "Delayed").length;

  if (authChecking) return <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading Waypoint…</main>;
  if (!token || !authUser) {
    return (
      <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
        <form onSubmit={handleAuthSubmit} className="delay-modal" style={{ width: "min(100%, 420px)" }}>
          <div className="brand-mark" style={{ marginBottom: 18 }}><Icon name="route" size={22} /></div>
          <div className="section-kicker">WAYPOINT · SCHOOL TRANSPORT</div>
          <h2>{registerParent ? "Create parent account" : "Sign in to Waypoint"}</h2>
          <p>{registerParent ? "Register to submit your student’s transport details." : "Sign in with your school, driver, or parent account."}</p>
          {registerParent && <div className="form-field"><label className="form-label">Full name</label><input name="name" required className="form-input" autoComplete="name" /></div>}
          <div className="form-field" style={{ marginBottom: 12 }}><label className="form-label">Email</label><input name="email" type="email" required className="form-input" autoComplete="username" /></div>
          <div className="form-field"><label className="form-label">Password</label><input name="password" type="password" required minLength={registerParent ? 10 : undefined} className="form-input" autoComplete={registerParent ? "new-password" : "current-password"} /></div>
          {authError && <p role="alert" style={{ color: "#be123c", margin: "12px 0 0" }}>{authError}</p>}
          <button className="action-primary-btn" disabled={authSubmitting} aria-busy={authSubmitting} style={{ width: "100%", justifyContent: "center", marginTop: 18 }}>{authSubmitting ? "Please wait…" : registerParent ? "Create parent account" : "Sign in"}</button>
          <button type="button" className="action-secondary-btn" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={() => { setRegisterParent(!registerParent); setAuthError(""); }}>
            {registerParent ? "Back to sign in" : "Register as a parent"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={(e) => { e.preventDefault(); setActiveTab("overview"); }}>
          <span className="brand-mark"><Icon name="route" size={21} /></span>
          <span className="brand-name">waypoint<span>.</span><small>SCHOOL TRANSPORT</small></span>
        </a>
        <div className="school-switch">
          <div className="school-avatar">P</div>
            <div className="school-copy">
            <strong>Pinecrest School</strong>
            <span>North Campus</span>
          </div>
          <span className="chevron">⌄</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          <button
            className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <Icon name="home" /> Overview
          </button>
          <button
            className={`nav-item ${activeTab === "live" ? "active" : ""}`}
            onClick={() => setActiveTab("live")}
          >
            <Icon name="bus" /> Live routes <span className="nav-count">{activeRoutesCount}</span>
          </button>
          {role !== "Parent" && <button
            className={`nav-item ${activeTab === "routes" ? "active" : ""}`}
            onClick={() => setActiveTab("routes")}
          >
            <Icon name="pin" /> Stops & routes
          </button>}
          <button
            className={`nav-item ${activeTab === "students" ? "active" : ""}`}
            onClick={() => setActiveTab("students")}
          >
            <Icon name="users" /> Students <span className="nav-count">{students.length}</span>
          </button>
          <button
            className={`nav-item ${activeTab === "notifications" ? "active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            <Icon name="bell" /> Notifications{" "}
            {unreadCount > 0 ? (
              <span className="unread-dot" title={`${unreadCount} unread`} />
            ) : null}
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><Icon name="shield" size={17} /></span>
            <strong>Every ride, accounted for.</strong>
            <p>Trip updates are shared with families in real time.</p>
            <button
              className="activity-link"
              style={{ padding: 0, border: 0, cursor: "pointer", color: "#4e977e", fontSize: "10px", fontWeight: 650 }}
              onClick={() => setActiveTab("notifications")}
            >
              How it works <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">{authUser.name.slice(0, 2).toUpperCase()}</div>
            <div className="profile-copy">
              <strong>{authUser.name}</strong>
              <span>{role}</span>
            </div>
            <button className="icon-button" aria-label="Edit profile" onClick={() => setShowProfileModal(true)}><Icon name="more" /></button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="main-area" id="home">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="breadcrumbs">
            Pinecrest School <span>/</span> Transport <span>/</span>{" "}
            <strong>
              {activeTab === "overview" && "Operations Overview"}
              {activeTab === "live" && "Live routes"}
              {activeTab === "routes" && "Stops & routes"}
              {activeTab === "students" && "Student Manifest"}
              {activeTab === "notifications" && "Alerts & Communications"}
            </strong>
          </div>
          <div className="top-actions">
            <time className="today-label" suppressHydrationWarning>
              {currentDateTime?.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) ?? ""}
            </time>
            <button
              className="top-icon"
              aria-label="Notifications"
              onClick={() => setActiveTab("notifications")}
              title="View notifications"
            >
              <Icon name="bell" size={18} />
              {unreadCount > 0 && <i />}
            </button>
            <div className="top-avatar">RK</div>
          </div>
        </header>

        <div className="page-content">
          {/* COMMON HEADER / EYEBROW */}
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="live-pulse" /> LIVE TRANSPORT SYSTEM
              </div>
              <h1>
                {role === "Parent" ? "Parent Dashboard" : `Welcome, ${authUser.name}`} <span className="wave">✳</span>
              </h1>
              <p>
                {activeTab === "overview" && "Fleet monitoring, student boarding status, and route coordination."}
                {activeTab === "live" && (role === "Parent" ? "Your student’s route and transport updates." : "Real-time bus tracking, driver stop updates, and family notifications.")}
                {activeTab === "routes" && "Manage school bus routes, scheduled stop timings, and pickup locations."}
                {activeTab === "students" && "Registered students, bus assignments, and guardian contacts."}
                {activeTab === "notifications" && "Real-time delay alerts, safety notices, and school announcements."}
              </p>
            </div>
            <div className="heading-actions">
              <span className="role-switch">{authUser.name} · {role}</span>
              {pendingRequests > 0 && <span role="status" aria-live="polite" style={{ fontSize: 11, color: "var(--text-muted)" }}>Syncing with database…</span>}
            {role === "School admin" && <button className="outline-button" onClick={() => { setEditingDriver(null); setDriverFormError(""); setDriverFormSuccess(""); setShowDriversModal(true); }}>
                <Icon name="users" size={15} /> Manage drivers
              </button>}
              {role === "School admin" && <button
                className="outline-button"
                onClick={() => {
                  setShowBroadcastModal(true);
                }}
              >
                <Icon name="send" size={15} /> Broadcast alert
              </button>}
              <button className="outline-button" onClick={handleSignOut} aria-label="Sign out">Sign out</button>
            </div>
          </section>

          {/* ============================================================== */}
          {/* TAB 1: OVERVIEW */}
          {/* ============================================================== */}
          {activeTab === "overview" && (
            <div>
              {/* Quick Action Buttons */}
              <div className="quick-actions-bar">
                {(role === "School admin" || role === "Parent") && <button
                  className="action-primary-btn"
                  onClick={() => { setEditingStudent(null); setShowAddStudentModal(true); }}
                >
                  <Icon name="plus" size={15} /> Add Student
                </button>}
                {role === "School admin" && <button
                  className="action-secondary-btn"
                  onClick={() => { setEditingRoute(null); setShowAddRouteModal(true); }}
                >
                  <Icon name="route" size={15} /> Create Route
                </button>}
                {role === "School admin" && <button
                  className="action-secondary-btn"
                  onClick={() => setShowBroadcastModal(true)}
                >
                  <Icon name="bell" size={15} /> Send Announcement
                </button>}
                <button
                  className="action-secondary-btn"
                  onClick={() => {
                    setSelectedRouteId(routes[0]?.id || "");
                    setActiveTab("live");
                  }}
                >
                  <Icon name="bus" size={15} /> Open Live Map
                </button>
              </div>

              {/* Stats Grid */}
              <section className="stats-grid" aria-label="Today's transport summary">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>ACTIVE ROUTES</span>
                    <span className="stat-icon lilac"><Icon name="route" size={17} /></span>
                  </div>
                  <div className="stat-value">
                    {activeRoutesCount} <small>/ {routes.length}</small>
                  </div>
                  <div className="stat-foot">
                    <span className="mini-bars"><i /><i /><i /><i /><i /><i /><i /></span>
                    <span>routes on the road</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>STUDENTS ONBOARD</span>
                    <span className="stat-icon mint"><Icon name="users" size={17} /></span>
                  </div>
                  <div className="stat-value">
                    {pickedUpCount} <small>/ {totalStudents}</small>
                  </div>
                  <div className="stat-foot">
                    <span className="foot-dot green-dot" /> {waitingCount} waiting at stops
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>ON-TIME ARRIVALS</span>
                    <span className="stat-icon butter"><Icon name="clock" size={17} /></span>
                  </div>
                  <div className="stat-value">96<small>%</small></div>
                  <div className="stat-foot">
                    <span className="foot-positive">↑ 4%</span>
                    <span>from last week</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>EXCEPTIONS / DELAYS</span>
                    <span className="stat-icon blush"><Icon name="alert" size={17} /></span>
                  </div>
                  <div className="stat-value">
                    {attentionRoutesCount} <small>alert</small>
                  </div>
                  <div className="stat-foot">
                    <span className="attention-copy">
                      {attentionRoutesCount > 0 ? "Route 03 · 8 min delay reported" : "All routes operating on schedule"}
                    </span>
                  </div>
                </div>
              </section>

              {/* Active Routes Cards */}
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">FLEET DISPATCH</div>
                    <h2>Active Routes Overview</h2>
                  </div>
                  <span className="stop-count">{routes.length} configured routes</span>
                </div>

                <div className="routes-grid">
                  {routes.map((r) => {
                    const rStudents = students.filter((s) => s.routeId === r.id);
                    const rPickedUp = rStudents.filter((s) => s.status === "Picked up").length;
                    return (
                      <div className="overview-route-card" key={r.id}>
                        <div className="orc-header">
                          <div className="orc-meta">
                            <span className="route-icon"><Icon name="bus" size={18} /></span>
                            <div>
                              <strong style={{ fontSize: 13, display: "block" }}>{r.number}</strong>
                              <span style={{ fontSize: 9, color: "#8a94a0" }}>{r.campus} · {r.id}</span>
                            </div>
                          </div>
                          <span
                            className={`badge ${
                              r.status === "Delayed"
                                ? "badge-amber"
                                : r.status === "Completed"
                                ? "badge-blue"
                                : "badge-green"
                            }`}
                          >
                            <i /> {r.status}
                          </span>
                        </div>

                        <div className="orc-body">
                          <div>
                            <span className="orc-metric-label">Driver</span>
                            <div className="orc-metric-val">
                              <span className="driver-avatar">{r.driver.avatar}</span>
                              {r.driver.name}
                            </div>
                          </div>
                          <div>
                            <span className="orc-metric-label">Vehicle</span>
                            <div className="orc-metric-val">{r.vehicle.reg}</div>
                          </div>
                          <div>
                            <span className="orc-metric-label">Boarded</span>
                            <div className="orc-metric-val">
                              {rPickedUp} / {rStudents.length || r.stops.filter((s) => s.student).length} students
                            </div>
                          </div>
                          <div>
                            <span className="orc-metric-label">ETA</span>
                            <div className="orc-metric-val">{r.eta}</div>
                          </div>
                        </div>

                        <div className="orc-footer">
                          <button
                            className="action-btn-small"
                            onClick={() => handleAdvanceStop(r.id)}
                            title="Progress bus to next stop for demo"
                          >
                            <Icon name="arrow" size={12} /> Progress stop
                          </button>
                          <button
                            className="text-button"
                            onClick={() => {
                              setSelectedRouteId(r.id);
                              setActiveTab("live");
                            }}
                          >
                            Live tracking <Icon name="arrow" size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fleet & Driver Safety Registry */}
              <div className="content-grid">
                <div className="table-container">
                  <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #f0f2f4" }}>
                    <div className="section-kicker">SAFETY & COMPLIANCE</div>
                    <h3 style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 650 }}>
                      Driver & Vehicle Readiness
                    </h3>
                  </div>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Driver Name</th>
                          <th>Assigned Route</th>
                          <th>Vehicle Reg</th>
                          <th>Capacity</th>
                          <th>Inspection</th>
                          <th>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {routes.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 650 }}>
                                <span className="driver-avatar">{r.driver.avatar}</span>
                                {r.driver.name}
                              </div>
                            </td>
                            <td>
                              <b>{r.number}</b> ({r.campus})
                            </td>
                            <td>{r.vehicle.reg}</td>
                            <td>{r.vehicle.capacity} seats</td>
                            <td>
                              <span className="badge badge-green"><i /> Passed</span>
                            </td>
                            <td>
                              <span style={{ color: "#509279", fontWeight: 600 }}>{r.driver.phone}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Operations Activity Stream */}
                <div className="panel activity-panel">
                  <div className="panel-heading activity-heading">
                    <div>
                      <div className="section-kicker">DISPATCH LOG</div>
                      <h2>Recent Operations</h2>
                    </div>
                    <span className="live-badge"><i /> Live</span>
                  </div>
                  <div className="activity-list">
                    {activity.slice(0, 6).map((item, i) => (
                      <div className="activity-item" key={`${item.id}-${i}`}>
                        <span className={`activity-icon ${item.tone}`}>{item.icon}</span>
                        <div className="activity-copy">
                          <strong>{item.title}</strong>
                          <span>{item.detail}</span>
                        </div>
                        <time dateTime={item.createdAt} suppressHydrationWarning>{formatNotificationAge(item.createdAt, item.time, currentDateTime)}</time>
                      </div>
                    ))}
                  </div>
                  <button
                    className="activity-link"
                    onClick={() => setActiveTab("notifications")}
                  >
                    View all notifications <Icon name="arrow" size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: LIVE ROUTES (Existing Map + Interactive Controls) */}
          {/* ============================================================== */}
          {activeTab === "live" && (
            <div>
              {/* Route Selector Strip */}
              <div className="tab-strip">
                {routes.map((r) => (
                  <button
                    key={r.id}
                    className={`tab-btn ${selectedRouteId === r.id ? "active" : ""}`}
                    onClick={() => setSelectedRouteId(r.id)}
                  >
                    <Icon name="bus" size={15} /> {r.number} ({r.campus})
                  </button>
                ))}
              </div>

              {/* Role Perspective Banner */}
              {role === "Parent" && (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 10,
                    padding: "16px 20px",
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span
                      style={{
                        background: "#dbeafe",
                        color: "#1d4ed8",
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="shield" size={18} />
                    </span>
                    <div>
                      <strong style={{ fontSize: 13, display: "block", color: "#1e3a8a", marginBottom: 2 }}>
                        Parent Live Portal · {parentStudent ? `Tracking ${parentStudent.name}` : "No student registered"}
                      </strong>
                      <span style={{ fontSize: 12, color: "#475569" }}>
                        {parentStudent ? `Assigned to ${routes.find((route) => route.id === parentStudent.routeId)?.number || parentStudent.routeId} · Pickup at ${parentStudent.stopName} · Status: ${parentStudent.status}` : "Register your student to see route and pickup updates."}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="action-btn-small"
                      style={{ padding: "8px 14px", fontSize: 12 }}
                      onClick={() => parentStudent && handleNotifyDriver(parentStudent)}
                      disabled={!parentStudent}
                    >
                      <Icon name="send" size={13} /> Notify Driver
                    </button>
                    {parentStudent && <button
                      className="action-btn-small action-btn-absent"
                      style={{ padding: "8px 14px", fontSize: 12 }}
                      onClick={() => {
                        handleStudentStatusChange(parentStudent.id, "Absent");
                      }}
                    >
                      Child Absent Today
                    </button>}
                  </div>
                </div>
              )}

              {role === "Driver" && (
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: 10,
                    padding: "16px 20px",
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span
                      style={{
                        background: "#d1fae5",
                        color: "#065f46",
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="bus" size={18} />
                    </span>
                    <div>
                      <strong style={{ fontSize: 13, display: "block", color: "#064e3b", marginBottom: 2 }}>
                        Driver Active Dashboard · {currentRoute.driver.name}
                      </strong>
                      <span style={{ fontSize: 12, color: "#047857" }}>
                        Vehicle: {currentRoute.vehicle.reg} · Serving Route: {currentRoute.number} ({currentRoute.campus})
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      className="action-primary-btn"
                      onClick={() => handleAdvanceStop(currentRoute.id)}
                    >
                      Next Stop <Icon name="arrow" size={14} />
                    </button>
                    <button
                      className="action-secondary-btn"
                      onClick={() => setShowDelayModal(true)}
                    >
                      <Icon name="alert" size={14} /> Report Delay
                    </button>
                  </div>
                </div>
              )}

              {/* Main Live Content Grid */}
              <section className="content-grid">
                <div className="panel route-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-kicker">ACTIVE TRIP ROUTE</div>
                      <h2>
                        {currentRoute.number} <span className="heading-date">· {currentRoute.campus}</span>
                      </h2>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="small-select"
                        onClick={() => handleAdvanceStop(currentRoute.id)}
                        title="Simulate vehicle moving to next stop"
                      >
                        Simulate Next Stop <span>▶</span>
                      </button>
                    </div>
                  </div>

                  <div className="route-card">
                    <div className="route-card-top">
                      <div className="route-ident">
                        <div className="route-icon"><Icon name="bus" size={20} /></div>
                        <div>
                          <h3>
                            {currentRoute.number}{" "}
                            <span className="route-status">
                              <i />
                              {currentRoute.status}
                            </span>
                          </h3>
                          <p>{currentRoute.campus} · {currentRoute.id}</p>
                        </div>
                      </div>
                      {role === "School admin" && <button
                        className="icon-button route-more"
                        aria-label="Route options"
                        onClick={() => setShowAddStopModal(true)}
                        title="Add stop"
                      >
                        <Icon name="plus" size={18} />
                      </button>}
                    </div>

                    <div className="route-meta">
                      <div>
                        <span className="meta-label">DRIVER</span>
                        <span className="driver-name">
                          <span className="driver-avatar">{currentRoute.driver.avatar}</span>
                          {currentRoute.driver.name} <span className="verified">✓</span>
                        </span>
                      </div>
                      <div>
                        <span className="meta-label">VEHICLE</span>
                        <strong className="vehicle-value">
                          {currentRoute.vehicle.model} <span>·</span> {currentRoute.vehicle.reg}
                        </strong>
                      </div>
                      <div>
                        <span className="meta-label">EST. ARRIVAL</span>
                        <strong className="eta-value">{currentRoute.eta}</strong>
                      </div>
                    </div>

                    {/* Live Trip Progression Sequence */}
                    <div className="sequence-view-card" aria-label="Live Trip Sequence Stepper">
                      <div className="sequence-header-row">
                        <div>
                          <div className="sequence-kicker">STEP-BY-STEP TRANSIT SEQUENCE</div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
                            {currentRoute.number} Route Workflow
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="live-badge">
                            <i /> Live GPS Active
                          </span>
                          <button
                            className="action-btn-small"
                            onClick={() => handleAdvanceStop(currentRoute.id)}
                            title="Simulate vehicle moving to next stop"
                          >
                            <Icon name="arrow" size={12} /> Advance Sequence
                          </button>
                        </div>
                      </div>

                      {/* Active Step Live Banner */}
                      {(() => {
                        const activeStop = currentRoute.stops.find((s) => s.status === "current") || currentRoute.stops[0];
                        const activeIndex = currentRoute.stops.findIndex((s) => s.status === "current");
                        const isDone = currentRoute.status === "Completed";
                        return (
                          <div className="sequence-live-banner">
                            <div className="sequence-banner-copy">
                              <span className="sequence-banner-icon">
                                <Icon name="bus" size={17} />
                              </span>
                              <div>
                                <strong style={{ fontSize: 13, display: "block", color: "var(--text-main)" }}>
                                  {isDone
                                    ? "Trip Completed · All stops reached successfully"
                                    : activeStop
                                    ? `Currently at Step ${activeIndex >= 0 ? activeIndex + 1 : 1}: ${activeStop.name}`
                                    : "Bus en route"}
                                </strong>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                  {isDone
                                    ? `Arrived at ${currentRoute.campus}`
                                    : activeStop
                                    ? `${activeStop.area} · Estimated Arrival: ${activeStop.time}${
                                        activeStop.student ? ` · Passenger: ${activeStop.student}` : ""
                                      }`
                                    : "Trip in progress"}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`badge ${
                                isDone ? "badge-blue" : currentRoute.status === "Delayed" ? "badge-amber" : "badge-green"
                              }`}
                            >
                              <i /> {isDone ? "Arrived" : currentRoute.status}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Sequence Flow Stepper */}
                      <div className="sequence-flow">
                        {currentRoute.stops.map((stop, i) => (
                          <div key={stop.id || i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 145 }}>
                            <div className={`sequence-step ${stop.status}`}>
                              <div className="sequence-step-top">
                                <span className="sequence-step-index">
                                  {i === currentRoute.stops.length - 1 ? "FINAL" : `STEP ${String(i + 1).padStart(2, "0")}`}
                                </span>
                                <span className="sequence-step-status">
                                  {stop.status === "done" && "✓ Done"}
                                  {stop.status === "current" && "Active 🚌"}
                                  {stop.status === "upcoming" && "Pending"}
                                </span>
                              </div>

                              <div className="sequence-step-name">{stop.name}</div>
                              <div className="sequence-step-time">{stop.time}</div>

                              <div className="sequence-step-foot">
                                {stop.student ? (
                                  <span>
                                    {stop.student}{" "}
                                    {stop.status === "done" ? (
                                      <b style={{ color: "var(--emerald-primary)" }}>· Boarded</b>
                                    ) : stop.status === "current" ? (
                                      <b style={{ color: "var(--emerald-primary)" }}>· Boarding</b>
                                    ) : (
                                      "· Next"
                                    )}
                                  </span>
                                ) : (
                                  <span>{stop.area}</span>
                                )}
                              </div>
                            </div>

                            {i < currentRoute.stops.length - 1 && (
                              <div
                                className={`sequence-arrow-divider ${
                                  stop.status === "done" || stop.status === "current" ? "active" : ""
                                }`}
                              >
                                →
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="route-progress">
                      <div className="progress-copy">
                        <span>
                          <b>
                            {currentRoute.stops.filter((s) => s.status === "done").length} of{" "}
                            {currentRoute.stops.length}
                          </b>{" "}
                          stops completed in sequence
                        </span>
                        <span>Next stop in <b>4 min</b></span>
                      </div>
                      <div className="progress-track"><i /></div>
                    </div>

                    <div className="route-footer">
                      <div className="avatar-stack">
                        <span>AM</span><span>AS</span>
                        <small>
                          {students.filter((s) => s.routeId === currentRoute.id).length || currentRoute.stops.length} students on this route
                        </small>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {
                          setActiveTab("routes");
                        }}
                      >
                        Manage stops <Icon name="arrow" size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Other routes switcher list */}
                  <div className="other-routes">
                    {routes
                      .filter((r) => r.id !== currentRoute.id)
                      .map((r) => (
                        <div className="other-route-row" key={r.id}>
                          <span className="other-route-icon"><Icon name="bus" size={17} /></span>
                          <span className="other-route-title">
                            <b>{r.number}</b>
                            <small>{r.campus} · {r.stops.length} stops</small>
                          </span>
                          <span
                            className={r.status === "Delayed" ? "delay-pill" : "on-time-pill"}
                          >
                            <i /> {r.status}
                          </span>
                          <span className="other-eta">{r.eta}</span>
                          <button
                            className="row-arrow"
                            aria-label={`Open ${r.number}`}
                            onClick={() => setSelectedRouteId(r.id)}
                          >
                            <Icon name="arrow" size={16} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Right Column: Activity and Stops */}
                <aside className="right-column">
                  <section className="panel activity-panel">
                    <div className="panel-heading activity-heading">
                      <div>
                        <div className="section-kicker">HAPPENING NOW</div>
                        <h2>Live activity</h2>
                      </div>
                      <span className="live-badge"><i /> Live</span>
                    </div>
                    <div className="activity-list">
                      {activity.slice(0, 5).map((event, i) => (
                        <div className="activity-item" key={`${event.title}-${i}`}>
                          <span className={`activity-icon ${event.tone}`}>{event.icon}</span>
                          <div className="activity-copy">
                            <strong>{event.title}</strong>
                            <span>{event.detail}</span>
                          </div>
                          <time dateTime={event.createdAt} suppressHydrationWarning>{formatNotificationAge(event.createdAt, event.time, currentDateTime)}</time>
                        </div>
                      ))}
                    </div>
                    <button
                      className="activity-link"
                      onClick={() => setActiveTab("notifications")}
                    >
                      View all activity <Icon name="arrow" size={15} />
                    </button>
                  </section>

                  {/* Route Stops Panel */}
                  <section className="panel stops-panel">
                    <div className="panel-heading stops-heading">
                      <div>
                        <div className="section-kicker">{currentRoute.number} · TODAY</div>
                        <h2>Today’s stops</h2>
                      </div>
                      {role === "School admin" && <button
                        className="small-select"
                        onClick={() => setShowAddStopModal(true)}
                        title="Add stop to route"
                      >
                        + Add stop
                      </button>}
                    </div>

                    <div className="stop-list">
                      {currentRoute.stops.map((stop, i) => (
                        <div className={`stop-row ${stop.status}`} key={stop.id || stop.name}>
                          <div className="stop-rail">
                            <span className="stop-marker">
                              {stop.status === "done" ? "✓" : stop.status === "current" ? <i /> : i + 1}
                            </span>
                            {i < currentRoute.stops.length - 1 && <span className="stop-connector" />}
                          </div>
                          <div className="stop-copy">
                            <div className="stop-title-row">
                              <strong>{stop.name}</strong>
                              <time>{stop.time}</time>
                            </div>
                            <span>
                              {stop.area}
                              {stop.student ? ` · ${stop.student}` : ""}
                            </span>
                            {stop.status === "current" && (
                              <div className="stop-current-label">
                                <i /> {role === "Driver" ? "You’re at this stop" : "Bus is 4 min away"}
                              </div>
                            )}
                          </div>
                          {stop.status === "current" && stop.student && (
                            <button
                              className="pickup-button"
                              onClick={() => handleMarkPickedUp(stop.student!)}
                            >
                              Picked up
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="parent-preview">
                      <div className="parent-preview-icon"><Icon name="users" size={16} /></div>
                      <div>
                        <strong>Families are in the loop</strong>
                        <span>Pickup updates reach parents instantly.</span>
                      </div>
                      <span className="sent-check">✓</span>
                    </div>
                  </section>
                </aside>
              </section>

              {/* Driver & Trip Update Toolbar */}
              <section className="driver-toolbar">
                <div className="driver-toolbar-copy">
                  <span className="driver-toolbar-icon"><Icon name="bus" size={18} /></span>
                  <div>
                    <strong>
                      {role === "Driver" ? "Driver Trip Controls" : "Trip Coordination Controls"}
                    </strong>
                    <span>
                      {role === "Driver"
                        ? "Broadcast stop changes and delays directly from the vehicle"
                        : `Send live status updates to families on ${currentRoute.number}`}
                    </span>
                  </div>
                </div>
                <div className="driver-actions">
                  <button
                    className="update-button"
                    onClick={() => handleUpdateStatus("At stop")}
                  >
                    <Icon name="pin" size={15} /> Arrived at stop
                  </button>
                  <button
                    className="update-button"
                    onClick={() => handleUpdateStatus("On the way")}
                  >
                    <Icon name="bus" size={15} /> Back on route
                  </button>
                  <button
                    className="delay-button"
                    onClick={() => setShowDelayModal(true)}
                  >
                    <Icon name="clock" size={15} /> Report delay
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: STOPS & ROUTES */}
          {/* ============================================================== */}
          {activeTab === "routes" && (
            <div>
              {/* Quick Actions Bar */}
              <div className="quick-actions-bar">
                {role === "School admin" && <button
                  className="action-primary-btn"
                  onClick={() => setShowAddStopModal(true)}
                >
                  <Icon name="plus" size={15} /> Add Stop to Route
                </button>}
                {role === "School admin" && <button
                  className="action-secondary-btn"
                  onClick={() => { setEditingRoute(null); setShowAddRouteModal(true); }}
                >
                  <Icon name="route" size={15} /> Create New Route
                </button>}
                <button
                  className="action-secondary-btn"
                  onClick={() => handleAdvanceStop(selectedRouteId)}
                >
                  <Icon name="arrow" size={15} /> Simulate Route Progress
                </button>
              </div>

              {/* Route Tabs */}
              <div className="tab-strip">
                {routes.map((r) => (
                  <button
                    key={r.id}
                    className={`tab-btn ${selectedRouteId === r.id ? "active" : ""}`}
                    onClick={() => setSelectedRouteId(r.id)}
                  >
                    <Icon name="bus" size={14} /> {r.number} ({r.campus})
                  </button>
                ))}
              </div>

              {/* Route Summary Card */}
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">ROUTE SPECIFICATIONS</div>
                    <h2>
                      {currentRoute.number} · {currentRoute.campus}
                    </h2>
                  </div>
                  <span
                    className={`badge ${
                      currentRoute.status === "Delayed"
                        ? "badge-amber"
                        : currentRoute.status === "Completed"
                        ? "badge-blue"
                        : "badge-green"
                    }`}
                  >
                    <i /> {currentRoute.status}
                  </span>
                  {role === "School admin" && currentRoute.id && <div style={{ display: "flex", gap: 8 }}>
                    <button className="action-btn-small" onClick={() => { setEditingRoute(currentRoute); setShowAddRouteModal(true); }}>Edit route</button>
                    <button className="action-btn-small action-btn-absent" onClick={() => handleDeleteRoute(currentRoute)}>Delete route</button>
                  </div>}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 16,
                    padding: "16px 0",
                    borderTop: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)",
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <span className="orc-metric-label">Assigned Driver</span>
                    <div className="orc-metric-val" style={{ marginTop: 4 }}>
                      <span className="driver-avatar">{currentRoute.driver.avatar}</span>
                      <b>{currentRoute.driver.name}</b>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{currentRoute.driver.phone}</span>
                  </div>
                  <div>
                    <span className="orc-metric-label">Vehicle Assignment</span>
                    <div className="orc-metric-val" style={{ marginTop: 4 }}>
                      <b>{currentRoute.vehicle.reg}</b>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{currentRoute.vehicle.model}</span>
                  </div>
                  <div>
                    <span className="orc-metric-label">Total Stops</span>
                    <div className="orc-metric-val" style={{ marginTop: 4 }}>
                      <b>{currentRoute.stops.length} designated stops</b>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Morning inbound run</span>
                  </div>
                  <div>
                    <span className="orc-metric-label">Estimated Arrival</span>
                    <div className="orc-metric-val" style={{ marginTop: 4 }}>
                      <b style={{ color: "var(--emerald-primary)" }}>{currentRoute.eta}</b>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Target school gate</span>
                  </div>
                </div>

                {/* Stop Sequencer */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>
                      Stop Sequence & Scheduled Timings
                    </h3>
                    {role === "School admin" && <button
                      className="small-select"
                      onClick={() => setShowAddStopModal(true)}
                    >
                      + Add new stop
                    </button>}
                  </div>

                  <div className="stops-sequencer">
                    {currentRoute.stops.map((stop, index) => (
                      <div className={`stop-card-item ${stop.status}`} key={stop.id || index}>
                        <div className="stop-card-left">
                          <div className="stop-number-badge">{index + 1}</div>
                          <div className="stop-info">
                            <strong>{stop.name}</strong>
                            <span>
                              {stop.area} {stop.student ? `· Student: ${stop.student}` : "· Campus Terminal"}
                            </span>
                          </div>
                        </div>

                        <div className="stop-card-actions">
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#4f5a67" }}>
                            {stop.time}
                          </span>
                          <span
                            className={`badge ${
                              stop.status === "done"
                                ? "badge-green"
                                : stop.status === "current"
                                ? "badge-blue"
                                : "badge-gray"
                            }`}
                          >
                            <i /> {stop.status}
                          </span>
                          {stop.status !== "done" && stop.student && (
                            <button
                              className="action-btn-small action-btn-pickup"
                              onClick={() => handleMarkPickedUp(stop.student!)}
                            >
                              <Icon name="check" size={11} /> Mark Picked Up
                            </button>
                          )}
                          {role === "School admin" && <>
                            <button className="action-btn-small" onClick={() => handleEditStop(stop)}>Edit</button>
                            <button className="action-btn-small action-btn-absent" onClick={() => handleDeleteStop(stop)}>Remove</button>
                          </>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: STUDENTS MANIFEST */}
          {/* ============================================================== */}
          {activeTab === "students" && (
            <div>
              {/* Summary Metrics */}
              <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>REGISTERED RIDERS</span>
                    <span className="stat-icon lilac"><Icon name="users" size={17} /></span>
                  </div>
                  <div className="stat-value">{students.length}</div>
                  <div className="stat-foot"><span>across all routes</span></div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>SAFELY ONBOARD</span>
                    <span className="stat-icon mint"><Icon name="check" size={17} /></span>
                  </div>
                  <div className="stat-value">{pickedUpCount}</div>
                  <div className="stat-foot"><span className="green-dot foot-dot" /> Picked up this morning</div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>WAITING AT STOP</span>
                    <span className="stat-icon butter"><Icon name="clock" size={17} /></span>
                  </div>
                  <div className="stat-value">{waitingCount}</div>
                  <div className="stat-foot"><span>Upcoming pickup points</span></div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>ABSENT TODAY</span>
                    <span className="stat-icon blush"><Icon name="alert" size={17} /></span>
                  </div>
                  <div className="stat-value">
                    {students.filter((s) => s.status === "Absent").length}
                  </div>
                  <div className="stat-foot"><span>Notified by parent</span></div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="filter-search-row">
                <div className="search-box">
                  <Icon name="search" size={16} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search by student, guardian, or stop..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>

                <div className="filter-chips">
                  <select
                    className="small-select"
                    value={studentRouteFilter}
                    onChange={(e) => setStudentRouteFilter(e.target.value)}
                    style={{ height: 35, padding: "0 10px", fontSize: 11 }}
                  >
                    <option value="all">All Routes</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>{r.number} ({r.campus})</option>
                    ))}
                  </select>

                  <button
                    className={`chip ${studentStatusFilter === "all" ? "active" : ""}`}
                    onClick={() => setStudentStatusFilter("all")}
                  >
                    All Statuses
                  </button>
                  <button
                    className={`chip ${studentStatusFilter === "waiting" ? "active" : ""}`}
                    onClick={() => setStudentStatusFilter("waiting")}
                  >
                    Waiting
                  </button>
                  <button
                    className={`chip ${studentStatusFilter === "picked up" ? "active" : ""}`}
                    onClick={() => setStudentStatusFilter("picked up")}
                  >
                    Picked Up
                  </button>
                  <button
                    className={`chip ${studentStatusFilter === "absent" ? "active" : ""}`}
                    onClick={() => setStudentStatusFilter("absent")}
                  >
                    Absent
                  </button>

                  {(role === "School admin" || role === "Parent") && <button
                    className="action-primary-btn"
                    style={{ marginLeft: "auto" }}
                    onClick={() => { setEditingStudent(null); setShowAddStudentModal(true); }}
                  >
                    <Icon name="plus" size={14} /> Add Student
                  </button>}
                </div>
              </div>

              {/* Students Data Table */}
              <div className="table-container">
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Grade</th>
                        <th>Route</th>
                        <th>Pickup Stop</th>
                        <th>Guardian</th>
                        <th>Emergency Phone</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "24px 0", color: "#87909c" }}>
                            No students match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((st) => (
                          <tr key={st.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span className="profile-avatar" style={{ width: 32, height: 32, fontSize: 11, fontWeight: 700 }}>
                                  {st.name.slice(0, 2).toUpperCase()}
                                </span>
                                <div>
                                  <strong style={{ display: "block", fontSize: 13, color: "var(--text-main)" }}>{st.name}</strong>
                                  {st.notes && (
                                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{st.notes}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 500 }}>{st.grade}</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                                {routes.find((r) => r.id === st.routeId)?.number || st.routeId}
                              </span>
                            </td>
                            <td>{st.stopName}</td>
                            <td>
                              <div>
                                <div style={{ fontWeight: 500 }}>{st.guardian.name}</div>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{st.guardian.relation}</span>
                              </div>
                            </td>
                            <td>
                              <span style={{ color: "var(--emerald-primary)", fontWeight: 600 }}>{st.guardian.phone}</span>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  st.status === "Picked up"
                                    ? "badge-green"
                                    : st.status === "Waiting"
                                    ? "badge-amber"
                                    : st.status === "Absent"
                                    ? "badge-rose"
                                    : "badge-blue"
                                }`}
                              >
                                <i /> {st.status}
                                {st.pickupTime && ` (${st.pickupTime})`}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                {role !== "Parent" && st.status !== "Picked up" && (
                                  <button
                                    className="action-btn-small action-btn-pickup"
                                    onClick={() => handleStudentStatusChange(st.id, "Picked up")}
                                    title="Mark Picked Up"
                                  >
                                    <Icon name="check" size={12} /> Picked up
                                  </button>
                                )}
                                {role !== "Parent" && st.status !== "Absent" && (
                                  <button
                                    className="action-btn-small action-btn-absent"
                                    onClick={() => handleStudentStatusChange(st.id, "Absent")}
                                    title="Mark Absent"
                                  >
                                    Absent
                                  </button>
                                )}
                                <button
                                  className="action-btn-small"
                                  onClick={() => setActiveContactStudent(st)}
                                  title="Contact guardian"
                                >
                                  <Icon name="phone" size={13} />
                                </button>
                                {role === "School admin" && <>
                                  <button className="action-btn-small" onClick={() => { setEditingStudent(st); setShowAddStudentModal(true); }} title="Edit student">Edit</button>
                                  <button className="action-btn-small action-btn-absent" onClick={() => handleDeleteStudent(st)} title="Delete student">Delete</button>
                                </>}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: NOTIFICATIONS & COMMUNICATIONS */}
          {/* ============================================================== */}
          {activeTab === "notifications" && (
            <div>
              <div className="notif-container">
                <div className="notif-header-row">
                  <div>
                    <div className="section-kicker">COMMUNICATIONS CENTER</div>
                    <h2 style={{ fontSize: 16, margin: "4px 0 0", fontWeight: 650 }}>
                      Live Alerts & Announcements
                    </h2>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      className="outline-button"
                      onClick={() => handleMarkAllNotificationsRead()}
                      disabled={unreadCount === 0}
                    >
                      <Icon name="check" size={14} /> Mark all read
                    </button>
                    {role === "School admin" && <button
                      className="action-primary-btn"
                      onClick={() => setShowBroadcastModal(true)}
                    >
                      <Icon name="send" size={14} /> New Broadcast
                    </button>}
                  </div>
                </div>

                {/* Filter Chips */}
                <div className="filter-chips" style={{ marginBottom: 16 }}>
                  <button
                    className={`chip ${notifCategoryFilter === "all" ? "active" : ""}`}
                    onClick={() => setNotifCategoryFilter("all")}
                  >
                    All Notifications ({notifications.length})
                  </button>
                  <button
                    className={`chip ${notifCategoryFilter === "delay" ? "active" : ""}`}
                    onClick={() => setNotifCategoryFilter("delay")}
                  >
                    Delays & Exceptions
                  </button>
                  <button
                    className={`chip ${notifCategoryFilter === "pickup" ? "active" : ""}`}
                    onClick={() => setNotifCategoryFilter("pickup")}
                  >
                    Pickups & Drop-offs
                  </button>
                  <button
                    className={`chip ${notifCategoryFilter === "announcement" ? "active" : ""}`}
                    onClick={() => setNotifCategoryFilter("announcement")}
                  >
                    School Announcements
                  </button>
                </div>

                {/* Notifications List */}
                <div className="notif-list">
                  {filteredNotifications.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "#8a94a0" }}>
                      No notifications found in this category.
                    </div>
                  ) : (
                    filteredNotifications.map((notif) => (
                      <div
                        className={`notif-item ${!notif.read ? "unread" : ""}`}
                        key={notif.id}
                      >
                        <div className={`notif-icon-circle ${notif.tone}`}>
                          {notif.category === "delay" && "!"}
                          {notif.category === "pickup" && "✓"}
                          {notif.category === "announcement" && "↗"}
                          {notif.category === "emergency" && "⚠"}
                        </div>

                        <div className="notif-body">
                          <div className="notif-topline">
                            <span className="notif-title">{notif.title}</span>
                            <time className="notif-time" dateTime={notif.createdAt} suppressHydrationWarning>
                              {formatNotificationAge(notif.createdAt, notif.time, currentDateTime)}
                            </time>
                          </div>
                          <p className="notif-message">{notif.message}</p>
                          <div className="notif-tags">
                            <span className="notif-tag">{notif.audience}</span>
                            {notif.routeId && (
                              <span className="notif-tag" style={{ background: "#edf7f1", color: "#378d6e" }}>
                                {notif.routeId}
                              </span>
                            )}
                            {!notif.read && (
                              <button
                                className="action-btn-small"
                                style={{ padding: "1px 6px", fontSize: 8, marginLeft: "auto" }}
                                onClick={() => handleMarkAllNotificationsRead(notif.id)}
                              >
                                Mark read
                              </button>
                            )}
                            {role === "School admin" && (
                              <button className="action-btn-small action-btn-absent" onClick={() => handleDeleteNotification(notif.id)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PAGE FOOTER */}
          <footer className="page-footer">
            <span>
              <Icon name="shield" size={14} /> Student information is securely coordinated between authorized families and school staff.
            </span>
            <span>
              Last synced just now <i /> All systems operational
            </span>
          </footer>
        </div>
      </main>

      {/* TOAST MESSAGE */}
      {notice && (
        <div className="toast" role="status">
          <span>✓</span>
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: REPORT DELAY */}
      {/* ============================================================== */}
      {showDelayModal && (
        <div className="modal-backdrop" onClick={() => setShowDelayModal(false)}>
          <div
            className="delay-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delay-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setShowDelayModal(false)} aria-label="Close">
              ×
            </button>
            <div className="modal-icon"><Icon name="clock" size={21} /></div>
            <div className="section-kicker">{currentRoute.number} · FAMILY UPDATE</div>
            <h2 id="delay-title">Report a delay</h2>
            <p>Let the school and families on this route know what to expect.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const reason = (form.elements.namedItem("reason") as HTMLSelectElement).value;
                const minutes = (form.elements.namedItem("minutes") as HTMLSelectElement).value;
                handleUpdateStatus("Delayed", reason, minutes);
              }}
            >
              <label className="delay-label" htmlFor="delay-reason">Reason for delay</label>
              <select id="delay-reason" name="reason" className="delay-select">
                <option>Traffic congestion</option>
                <option>Road closure</option>
                <option>Vehicle mechanical issue</option>
                <option>Adverse weather conditions</option>
              </select>

              <label className="delay-label" htmlFor="delay-minutes">Estimated delay</label>
              <select id="delay-minutes" name="minutes" className="delay-select">
                <option value="5">About 5 minutes</option>
                <option value="10">About 10 minutes</option>
                <option value="15">About 15 minutes</option>
                <option value="25">More than 20 minutes</option>
              </select>

              <button type="submit" className="confirm-delay">
                Notify families <Icon name="arrow" size={16} />
              </button>
            </form>
            <span className="modal-note">
              <Icon name="shield" size={13} /> Sent to families on {currentRoute.number} and school dispatch
            </span>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ADD STOP */}
      {/* ============================================================== */}
      {showAddStopModal && (
        <div className="modal-backdrop" onClick={() => setShowAddStopModal(false)}>
          <div
            className="delay-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setShowAddStopModal(false)} aria-label="Close">
              ×
            </button>
            <div className="modal-icon" style={{ background: "#e8f4ef", color: "#38a886" }}>
              <Icon name="pin" size={21} />
            </div>
            <div className="section-kicker">{currentRoute.number} · ROUTE MANAGEMENT</div>
            <h2>Add New Stop</h2>
            <p>Insert a designated pickup stop with scheduled arrival time.</p>

            <form onSubmit={handleAddStopSubmit} className="form-grid">
              <div className="form-field">
                <label className="form-label">Stop Name</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Silver Crest Apartments"
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label className="form-label">Landmark / Gate</label>
                <input
                  name="area"
                  required
                  placeholder="e.g. Main Gate · Pillar 14"
                  className="form-input"
                />
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Scheduled Time</label>
                  <input
                    name="time"
                    required
                    placeholder="e.g. 7:52 AM"
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Assigned Student (Optional)</label>
                  <input
                    name="student"
                    placeholder="e.g. Varun Rao"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="action-secondary-btn"
                  onClick={() => setShowAddStopModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="action-primary-btn">
                  Save Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: CREATE ROUTE */}
      {/* ============================================================== */}
      {showAddRouteModal && (
        <div className="modal-backdrop" onClick={() => { setShowAddRouteModal(false); setEditingRoute(null); }}>
          <div
            className="delay-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => { setShowAddRouteModal(false); setEditingRoute(null); }} aria-label="Close">
              ×
            </button>
            <div className="modal-icon" style={{ background: "#edf2fa", color: "#5575cf" }}>
              <Icon name="route" size={21} />
            </div>
            <div className="section-kicker">FLEET MANAGEMENT</div>
            <h2>{editingRoute ? "Edit Route" : "Create New Route"}</h2>
            <p>Configure the route, campus destination, driver account, and vehicle assignment.</p>

            <form key={editingRoute?.id || "new-route"} onSubmit={handleAddRouteSubmit} className="form-grid">
              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Route Number / Code</label>
                  <input
                    name="number"
                    required
                    defaultValue={editingRoute?.number || ""}
                    placeholder="e.g. Route 09"
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Campus</label>
                  <input
                    name="campus"
                    required
                    defaultValue={editingRoute?.campus || ""}
                    placeholder="e.g. West Campus"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Assign driver account</label>
                <select name="driverId" className="form-select" defaultValue={editingRoute?.driver.id || ""}>
                  <option value="">Legacy driver details only</option>
                  {drivers.filter((driver) => driver.isActive).map((driver) => <option key={driver.id} value={driver.id}>{driver.name} · {driver.email}</option>)}
                </select>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Driver Name (if no account)</label>
                  <input
                    name="driverName"
                    defaultValue={editingRoute?.driver.name || ""}
                    placeholder="e.g. Mohan Lal"
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Driver Phone</label>
                  <input
                    name="driverPhone"
                    defaultValue={editingRoute?.driver.phone || ""}
                    placeholder="+91 98765 12345"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Vehicle Registration</label>
                  <input
                    name="vehicleReg"
                    required
                    defaultValue={editingRoute?.vehicle.reg || ""}
                    placeholder="e.g. KA 05 MN 9922"
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Vehicle Model</label>
                  <input name="vehicleModel" defaultValue={editingRoute?.vehicle.model || "School bus"} className="form-input" />
                </div>
              </div>
              <div className="form-field">
                  <label className="form-label">Seating Capacity</label>
                  <input
                    name="capacity"
                    type="number"
                    defaultValue={editingRoute?.vehicle.capacity || 32}
                    className="form-input"
                  />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="action-secondary-btn"
                  onClick={() => { setShowAddRouteModal(false); setEditingRoute(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="action-primary-btn">
                  {editingRoute ? "Save Route" : "Create Route"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ADD STUDENT */}
      {/* ============================================================== */}
      {showAddStudentModal && (
        <div className="modal-backdrop" onClick={() => { setShowAddStudentModal(false); setEditingStudent(null); }}>
          <div
            className="delay-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => { setShowAddStudentModal(false); setEditingStudent(null); }} aria-label="Close">
              ×
            </button>
            <div className="modal-icon" style={{ background: "#faf4e8", color: "#b99451" }}>
              <Icon name="users" size={21} />
            </div>
            <div className="section-kicker">STUDENT REGISTRATION</div>
            <h2>{editingStudent ? "Edit Student" : "Register New Student"}</h2>
            <p>Save student, guardian, and route details to the school database.</p>

            <form key={editingStudent?.id || "new-student"} onSubmit={handleAddStudentSubmit} className="form-grid">
              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Student Full Name</label>
                  <input
                    name="name"
                    required
                    defaultValue={editingStudent?.name || ""}
                    placeholder="e.g. Riyaan Sen"
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Grade / Section</label>
                  <input
                    name="grade"
                    required
                    defaultValue={editingStudent?.grade || ""}
                    placeholder="e.g. Grade 4-A"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Assigned Route</label>
                  <select name="routeId" className="form-select" required defaultValue={editingStudent?.routeId || selectedRouteId}>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>{r.number} ({r.campus})</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Pickup Stop</label>
                  <input
                    name="stopName"
                    required
                    defaultValue={editingStudent?.stopName || ""}
                    placeholder="e.g. Rosewood Society"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Guardian Name</label>
                  <input
                    name="guardianName"
                    required
                    defaultValue={editingStudent?.guardian.name || ""}
                    placeholder="e.g. Shweta Sen"
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Guardian Phone</label>
                  <input
                    name="guardianPhone"
                    required
                    defaultValue={editingStudent?.guardian.phone || ""}
                    placeholder="+91 98765 00112"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field"><label className="form-label">Guardian relation</label><input name="guardianRelation" defaultValue={editingStudent?.guardian.relation || "Parent"} className="form-input" /></div>
                <div className="form-field"><label className="form-label">Emergency contact</label><input name="emergencyContact" defaultValue={editingStudent?.emergencyContact || ""} className="form-input" /></div>
              </div>

              <div className="form-field">
                <label className="form-label">Special Notes (Optional)</label>
                <input
                  name="notes"
                  defaultValue={editingStudent?.notes || ""}
                  placeholder="e.g. Assisted boarding required"
                  className="form-input"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="action-secondary-btn"
                  onClick={() => { setShowAddStudentModal(false); setEditingStudent(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="action-primary-btn">
                  {editingStudent ? "Save Student" : "Register Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: BROADCAST ANNOUNCEMENT */}
      {/* ============================================================== */}
      {showBroadcastModal && (
        <div className="modal-backdrop" onClick={() => setShowBroadcastModal(false)}>
          <div
            className="delay-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setShowBroadcastModal(false)} aria-label="Close">
              ×
            </button>
            <div className="modal-icon" style={{ background: "#edf2fa", color: "#5575cf" }}>
              <Icon name="send" size={21} />
            </div>
            <div className="section-kicker">DISPATCH BROADCAST</div>
            <h2>Send Transport Alert</h2>
            <p>Broadcast an instant notification to parents, drivers, and coordinators.</p>

            <form onSubmit={handleBroadcastSubmit} className="form-grid">
              <div className="form-field">
                <label className="form-label">Alert Title</label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Rain Delay Advisory / Traffic Notice"
                  className="form-input"
                />
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="form-label">Target Audience</label>
                  <select name="audience" className="form-select">
                    <option>All Families & Staff</option>
                    <option>Route 08 Families</option>
                    <option>Route 03 Families</option>
                    <option>Route 05 Families</option>
                    <option>Drivers Only</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Alert Category</label>
                  <select name="category" className="form-select">
                    <option value="announcement">Announcement</option>
                    <option value="delay">Delay Notice</option>
                    <option value="pickup">Trip Update</option>
                    <option value="emergency">Emergency / Urgent</option>
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Tone / Priority</label>
                <select name="tone" className="form-select">
                  <option value="blue">Standard Info (Blue)</option>
                  <option value="amber">Attention / Delay (Amber)</option>
                  <option value="green">Positive / Arrival (Green)</option>
                  <option value="rose">Urgent / Alert (Rose)</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Message Details</label>
                <textarea
                  name="message"
                  required
                  placeholder="Write clear instructions for parents or drivers..."
                  className="form-textarea"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="action-secondary-btn"
                  onClick={() => setShowBroadcastModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="action-primary-btn">
                  Dispatch Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDriversModal && (
        <div className="modal-backdrop" onClick={() => { setShowDriversModal(false); setEditingDriver(null); }}>
          <div className="delay-modal drivers-modal" role="dialog" aria-modal="true" aria-labelledby="drivers-title" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowDriversModal(false); setEditingDriver(null); }} aria-label="Close">×</button>
            <div className="section-kicker">SCHOOL ADMINISTRATION</div>
            <h2 id="drivers-title">Manage driver accounts</h2>
            <p>Each driver signs in with an individual account. Deactivation keeps their route history.</p>
            {driverFormError && <p role="alert" style={{ color: "#be123c", margin: "8px 0" }}>{driverFormError}</p>}
            {driverFormSuccess && <p role="status" style={{ color: "#047857", margin: "8px 0" }}>{driverFormSuccess}</p>}
            <div className="table-container" style={{ margin: "16px 0" }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead><tr><th>Driver</th><th>Assigned route</th><th>Account</th><th>Actions</th></tr></thead>
                  <tbody>
                    {drivers.length ? drivers.map((driver) => (
                      <tr key={driver.id}>
                        <td><strong>{driver.name}</strong><br /><span style={{ fontSize: 11 }}>{driver.email}</span></td>
                        <td>{driver.routes.map((route) => route.number).join(", ") || "Unassigned"}</td>
                        <td>{driver.isActive ? "Active" : "Inactive"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button type="button" className="action-btn-small" onClick={() => { setDriverFormError(""); setDriverFormSuccess(""); setEditingDriver(driver); }}>Edit</button>{" "}
                          {driver.isActive
                            ? <button type="button" className="action-btn-small action-btn-absent" onClick={() => handleDeactivateDriver(driver)}>Deactivate</button>
                            : <button type="button" className="action-btn-small action-btn-pickup" onClick={() => handleReactivateDriver(driver)}>Reactivate</button>}
                        </td>
                      </tr>
                    )) : <tr><td colSpan={4} style={{ textAlign: "center" }}>No driver accounts yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <h3 style={{ fontSize: 15 }}>{editingDriver ? `Edit ${editingDriver.name}` : "Create driver account"}</h3>
            <form key={editingDriver?.id || "new-driver"} onSubmit={handleDriverSubmit} className="form-grid">
              <div className="form-row-2">
                <div className="form-field"><label className="form-label">Full name</label><input name="name" required defaultValue={editingDriver?.name || ""} className="form-input" /></div>
                <div className="form-field"><label className="form-label">Email</label><input name="email" type="email" required defaultValue={editingDriver?.email || ""} className="form-input" autoComplete="username" /></div>
              </div>
              <div className="form-row-2">
                <div className="form-field"><label className="form-label">{editingDriver ? "New password (optional)" : "Password"}</label><input name="password" type="password" required={!editingDriver} minLength={10} maxLength={200} className="form-input" autoComplete="new-password" /><small>Use 10–200 characters. The driver signs in with this email and password.</small></div>
                <div className="form-field"><label className="form-label">Assigned route</label><select name="routeId" className="form-select" defaultValue={editingDriver?.routes[0]?.id || ""}><option value="">Unassigned</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.number} · {route.campus}</option>)}</select></div>
              </div>
              <label className="form-label" style={{ display: "flex", gap: 8, alignItems: "center" }}><input name="isActive" type="checkbox" defaultChecked={editingDriver?.isActive ?? true} /> Account is active</label>
              <div className="form-actions">
                <button type="button" className="action-secondary-btn" onClick={() => { setEditingDriver(null); setDriverFormError(""); setDriverFormSuccess(""); }}>Clear form</button>
                <button type="submit" className="action-primary-btn" disabled={pendingRequests > 0} aria-busy={pendingRequests > 0}>{pendingRequests > 0 ? "Saving…" : editingDriver ? "Save changes" : "Create driver"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProfileModal && authUser && (
        <div className="modal-backdrop" onClick={() => setShowProfileModal(false)}>
          <div className="delay-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowProfileModal(false)} aria-label="Close">×</button>
            <div className="section-kicker">ACCOUNT SETTINGS</div><h2 id="profile-title">Edit profile</h2>
            <form onSubmit={handleProfileSubmit} className="form-grid">
              <div className="form-field"><label className="form-label">Full name</label><input name="name" required defaultValue={authUser.name} className="form-input" autoComplete="name" /></div>
              <div className="form-field"><label className="form-label">Email</label><input name="email" type="email" required defaultValue={authUser.email} className="form-input" autoComplete="email" /></div>
              <div className="form-actions"><button type="button" className="action-secondary-btn" onClick={() => setShowProfileModal(false)}>Cancel</button><button type="submit" className="action-primary-btn">Save profile</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: GUARDIAN CONTACT DETAILS */}
      {/* ============================================================== */}
      {activeContactStudent && (
        <div className="modal-backdrop" onClick={() => setActiveContactStudent(null)}>
          <div
            className="delay-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setActiveContactStudent(null)} aria-label="Close">
              ×
            </button>
            <div className="modal-icon" style={{ background: "var(--emerald-bg)", color: "var(--emerald-primary)" }}>
              <Icon name="phone" size={22} />
            </div>
            <div className="section-kicker">GUARDIAN CONTACT</div>
            <h2>{activeContactStudent.name}</h2>
            <p>{activeContactStudent.grade} · Designated Stop: {activeContactStudent.stopName}</p>

            <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <div style={{ marginBottom: 12 }}>
                <span className="orc-metric-label">Primary Guardian</span>
                <div style={{ fontWeight: 650, fontSize: 14, color: "var(--text-main)", marginTop: 2 }}>
                  {activeContactStudent.guardian.name} ({activeContactStudent.guardian.relation})
                </div>
                <div style={{ color: "var(--emerald-primary)", fontWeight: 600, fontSize: 13, marginTop: 3 }}>
                  {activeContactStudent.guardian.phone}
                </div>
              </div>

              <div>
                <span className="orc-metric-label">Emergency Contact Hotline</span>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-main)", marginTop: 2 }}>
                  {activeContactStudent.emergencyContact}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                className="action-primary-btn"
                style={{ justifyContent: "center", height: 40, fontSize: 13 }}
                onClick={() => {
                  flashNotice(`Initiated simulated call to ${activeContactStudent.guardian.name}`);
                  setActiveContactStudent(null);
                }}
              >
                <Icon name="phone" size={15} /> Call Guardian
              </button>
              <button
                className="action-secondary-btn"
                style={{ justifyContent: "center", height: 40, fontSize: 13 }}
                onClick={() => {
                  flashNotice(`SMS alert sent to ${activeContactStudent.guardian.phone}`);
                  setActiveContactStudent(null);
                }}
              >
                <Icon name="send" size={15} /> Send SMS Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
