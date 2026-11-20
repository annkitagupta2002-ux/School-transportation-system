// Shared API response types only. Runtime records are loaded from the Express API.
export type RouteStatus = "Scheduled" | "On the way" | "At stop" | "Completed" | "Delayed";
export type StopStatus = "done" | "current" | "upcoming";
export type StudentStatus = "Waiting" | "Picked up" | "Dropped off" | "Absent";
export type NotificationCategory = "delay" | "pickup" | "announcement" | "emergency";

export interface Stop {
  id: string;
  name: string;
  area: string;
  time: string;
  status: StopStatus;
  student?: string;
}

export interface RouteItem {
  id: string;
  number: string;
  campus: string;
  status: RouteStatus;
  driver: {
    id?: string;
    name: string;
    phone: string;
    avatar: string;
    verified: boolean;
  };
  vehicle: {
    reg: string;
    model: string;
    capacity: number;
    inspectionStatus: "Passed" | "Pending";
  };
  eta: string;
  currentStopIndex: number;
  stops: Stop[];
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  routeId: string;
  stopName: string;
  status: StudentStatus;
  pickupTime?: string;
  guardian: { name: string; phone: string; relation: string };
  emergencyContact: string;
  notes?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  routeId?: string;
  audience: string;
  time: string;
  createdAt?: string;
  read: boolean;
  tone: "green" | "blue" | "amber" | "rose";
}

export interface ActivityEvent {
  id: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  createdAt?: string;
  tone: "green" | "blue" | "amber";
  routeId?: string;
}

export interface TransportState {
  routes: RouteItem[];
  students: Student[];
  notifications: NotificationItem[];
  activity: ActivityEvent[];
}
