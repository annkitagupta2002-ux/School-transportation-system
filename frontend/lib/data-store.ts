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
  guardian: {
    name: string;
    phone: string;
    relation: string;
  };
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
  read: boolean;
  tone: "green" | "blue" | "amber" | "rose";
}

export interface ActivityEvent {
  id: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  tone: "green" | "blue" | "amber";
  routeId?: string;
}

export interface TransportState {
  routes: RouteItem[];
  students: Student[];
  notifications: NotificationItem[];
  activity: ActivityEvent[];
}

const defaultRoutes: RouteItem[] = [
  {
    id: "RTE-008",
    number: "Route 08",
    campus: "North Campus",
    status: "On the way",
    driver: {
      name: "Amit Singh",
      phone: "+91 98765 01008",
      avatar: "AS",
      verified: true,
    },
    vehicle: {
      reg: "KA 05 MN 2048",
      model: "Tata Starbus 32-Seater",
      capacity: 32,
      inspectionStatus: "Passed",
    },
    eta: "8:10 AM · 17 min",
    currentStopIndex: 2,
    stops: [
      { id: "ST-08-1", name: "Lakeview Apartments", area: "North Gate · Stop 01", time: "7:32 AM", status: "done", student: "Aarav Mehta" },
      { id: "ST-08-2", name: "Green Park Crossing", area: "Main Road · Stop 02", time: "7:40 AM", status: "done", student: "Anaya Sharma" },
      { id: "ST-08-3", name: "Rosewood Society", area: "Community Hall · Stop 03", time: "7:48 AM", status: "current", student: "Ishaan Kapoor" },
      { id: "ST-08-4", name: "Cedar Grove", area: "Block C · Stop 04", time: "7:56 AM", status: "upcoming", student: "Mira Patel" },
      { id: "ST-08-5", name: "Pinecrest School", area: "School entrance · Final stop", time: "8:10 AM", status: "upcoming" },
    ],
  },
  {
    id: "RTE-003",
    number: "Route 03",
    campus: "South Campus",
    status: "Delayed",
    driver: {
      name: "Rajesh Kumar",
      phone: "+91 98765 01003",
      avatar: "RK",
      verified: true,
    },
    vehicle: {
      reg: "KA 05 MN 1092",
      model: "Ashok Leyland Falcon",
      capacity: 40,
      inspectionStatus: "Passed",
    },
    eta: "8:22 AM · 28 min",
    currentStopIndex: 1,
    stops: [
      { id: "ST-03-1", name: "Palm Meadows", area: "Clubhouse Gate · Stop 01", time: "7:30 AM", status: "done", student: "Rohan Verma" },
      { id: "ST-03-2", name: "Silver Crest Complex", area: "Phase 2 Circle · Stop 02", time: "7:42 AM", status: "current", student: "Tanvi Iyer" },
      { id: "ST-03-3", name: "South Gate Junction", area: "Signal Point · Stop 03", time: "7:55 AM", status: "upcoming", student: "Dev Malhotra" },
      { id: "ST-03-4", name: "Pinecrest School", area: "South Wing Gate", time: "8:22 AM", status: "upcoming" },
    ],
  },
  {
    id: "RTE-005",
    number: "Route 05",
    campus: "East Campus",
    status: "On the way",
    driver: {
      name: "Sunita Rao",
      phone: "+91 98765 01005",
      avatar: "SR",
      verified: true,
    },
    vehicle: {
      reg: "KA 05 MN 3310",
      model: "Force Traveller 24",
      capacity: 24,
      inspectionStatus: "Passed",
    },
    eta: "8:18 AM · 22 min",
    currentStopIndex: 1,
    stops: [
      { id: "ST-05-1", name: "Sunrise Valley", area: "Arch Road · Stop 01", time: "7:35 AM", status: "done", student: "Kabir Das" },
      { id: "ST-05-2", name: "Tech Zone Cross", area: "IT Gate · Stop 02", time: "7:47 AM", status: "current", student: "Zoya Khan" },
      { id: "ST-05-3", name: "Maple Woods", area: "Avenue 4 · Stop 03", time: "8:00 AM", status: "upcoming", student: "Reyansh Gupta" },
      { id: "ST-05-4", name: "Pinecrest School", area: "East Campus Gate", time: "8:18 AM", status: "upcoming" },
    ],
  },
  {
    id: "RTE-001",
    number: "Route 01",
    campus: "West Valley",
    status: "Scheduled",
    driver: {
      name: "Vikram Verma",
      phone: "+91 98765 01001",
      avatar: "VV",
      verified: true,
    },
    vehicle: {
      reg: "KA 05 MN 4421",
      model: "Tata CityRide 34",
      capacity: 34,
      inspectionStatus: "Passed",
    },
    eta: "8:35 AM · Scheduled",
    currentStopIndex: 0,
    stops: [
      { id: "ST-01-1", name: "West Valley Plaza", area: "Clock Tower · Stop 01", time: "8:00 AM", status: "upcoming", student: "Saanvi Joshi" },
      { id: "ST-01-2", name: "Heights Avenue", area: "Sector 9 · Stop 02", time: "8:12 AM", status: "upcoming", student: "Arjun Nair" },
      { id: "ST-01-3", name: "Pinecrest School", area: "Main Entrance", time: "8:35 AM", status: "upcoming" },
    ],
  },
];

const defaultStudents: Student[] = [
  {
    id: "STU-001",
    name: "Aarav Mehta",
    grade: "Grade 4-B",
    routeId: "RTE-008",
    stopName: "Lakeview Apartments",
    status: "Picked up",
    pickupTime: "7:32 AM",
    guardian: { name: "Rohit Mehta", phone: "+91 98201 12345", relation: "Father" },
    emergencyContact: "+91 98201 12346",
    notes: "Front seats preferred",
  },
  {
    id: "STU-002",
    name: "Anaya Sharma",
    grade: "Grade 3-A",
    routeId: "RTE-008",
    stopName: "Green Park Crossing",
    status: "Picked up",
    pickupTime: "7:40 AM",
    guardian: { name: "Pooja Sharma", phone: "+91 98202 23456", relation: "Mother" },
    emergencyContact: "+91 98202 23457",
  },
  {
    id: "STU-003",
    name: "Ishaan Kapoor",
    grade: "Grade 5-C",
    routeId: "RTE-008",
    stopName: "Rosewood Society",
    status: "Waiting",
    guardian: { name: "Vikram Kapoor", phone: "+91 98203 34567", relation: "Father" },
    emergencyContact: "+91 98203 34568",
    notes: "Carries asthma inhaler",
  },
  {
    id: "STU-004",
    name: "Mira Patel",
    grade: "Grade 2-B",
    routeId: "RTE-008",
    stopName: "Cedar Grove",
    status: "Waiting",
    guardian: { name: "Neha Patel", phone: "+91 98204 45678", relation: "Mother" },
    emergencyContact: "+91 98204 45679",
  },
  {
    id: "STU-005",
    name: "Rohan Verma",
    grade: "Grade 6-A",
    routeId: "RTE-003",
    stopName: "Palm Meadows",
    status: "Picked up",
    pickupTime: "7:30 AM",
    guardian: { name: "Sunil Verma", phone: "+91 98205 56789", relation: "Father" },
    emergencyContact: "+91 98205 56780",
  },
  {
    id: "STU-006",
    name: "Tanvi Iyer",
    grade: "Grade 4-A",
    routeId: "RTE-003",
    stopName: "Silver Crest Complex",
    status: "Waiting",
    guardian: { name: "Deepa Iyer", phone: "+91 98206 67890", relation: "Mother" },
    emergencyContact: "+91 98206 67891",
  },
  {
    id: "STU-007",
    name: "Dev Malhotra",
    grade: "Grade 7-B",
    routeId: "RTE-003",
    stopName: "South Gate Junction",
    status: "Waiting",
    guardian: { name: "Kunal Malhotra", phone: "+91 98207 78901", relation: "Father" },
    emergencyContact: "+91 98207 78902",
  },
  {
    id: "STU-008",
    name: "Kabir Das",
    grade: "Grade 1-C",
    routeId: "RTE-005",
    stopName: "Sunrise Valley",
    status: "Picked up",
    pickupTime: "7:35 AM",
    guardian: { name: "Ananya Das", phone: "+91 98208 89012", relation: "Mother" },
    emergencyContact: "+91 98208 89013",
  },
  {
    id: "STU-009",
    name: "Zoya Khan",
    grade: "Grade 5-B",
    routeId: "RTE-005",
    stopName: "Tech Zone Cross",
    status: "Waiting",
    guardian: { name: "Farhan Khan", phone: "+91 98209 90123", relation: "Father" },
    emergencyContact: "+91 98209 90124",
  },
  {
    id: "STU-010",
    name: "Reyansh Gupta",
    grade: "Grade 3-C",
    routeId: "RTE-005",
    stopName: "Maple Woods",
    status: "Waiting",
    guardian: { name: "Meera Gupta", phone: "+91 98210 01234", relation: "Mother" },
    emergencyContact: "+91 98210 01235",
  },
  {
    id: "STU-011",
    name: "Saanvi Joshi",
    grade: "Grade 6-B",
    routeId: "RTE-001",
    stopName: "West Valley Plaza",
    status: "Waiting",
    guardian: { name: "Alok Joshi", phone: "+91 98211 12345", relation: "Father" },
    emergencyContact: "+91 98211 12346",
  },
  {
    id: "STU-012",
    name: "Arjun Nair",
    grade: "Grade 8-A",
    routeId: "RTE-001",
    stopName: "Heights Avenue",
    status: "Waiting",
    guardian: { name: "Radhika Nair", phone: "+91 98212 23456", relation: "Mother" },
    emergencyContact: "+91 98212 23457",
  },
];

const defaultNotifications: NotificationItem[] = [
  {
    id: "NOTIF-1",
    title: "Route 03 Delay Reported",
    message: "Bus 03 is delayed by approx. 8 minutes due to traffic near South Gate Junction.",
    category: "delay",
    routeId: "RTE-003",
    audience: "Route 03 Families & Dispatch",
    time: "7:45 AM",
    read: false,
    tone: "amber",
  },
  {
    id: "NOTIF-2",
    title: "Anaya Sharma Picked Up",
    message: "Anaya has safely boarded Bus 08 at Green Park Crossing (Stop 02).",
    category: "pickup",
    routeId: "RTE-008",
    audience: "Sharma Family",
    time: "7:40 AM",
    read: false,
    tone: "green",
  },
  {
    id: "NOTIF-3",
    title: "Aarav Mehta Picked Up",
    message: "Aarav has safely boarded Bus 08 at Lakeview Apartments (Stop 01).",
    category: "pickup",
    routeId: "RTE-008",
    audience: "Mehta Family",
    time: "7:32 AM",
    read: true,
    tone: "green",
  },
  {
    id: "NOTIF-4",
    title: "Morning Transport Dispatch Started",
    message: "All 4 morning routes have completed safety checks and commenced their routes.",
    category: "announcement",
    audience: "All Families & Staff",
    time: "7:15 AM",
    read: true,
    tone: "blue",
  },
];

const defaultActivity: ActivityEvent[] = [
  { id: "ACT-1", icon: "✓", title: "Anaya was picked up", detail: "Green Park Crossing · Stop 02", time: "7:40 AM", tone: "green", routeId: "RTE-008" },
  { id: "ACT-2", icon: "✓", title: "Aarav was picked up", detail: "Lakeview Apartments · Stop 01", time: "7:32 AM", tone: "green", routeId: "RTE-008" },
  { id: "ACT-3", icon: "!", title: "Route 03 reported 8 min delay", detail: "South Campus · Traffic congestion", time: "7:45 AM", tone: "amber", routeId: "RTE-003" },
  { id: "ACT-4", icon: "✓", title: "Kabir was picked up", detail: "Sunrise Valley · Stop 01", time: "7:35 AM", tone: "green", routeId: "RTE-005" },
  { id: "ACT-5", icon: "✓", title: "Rohan was picked up", detail: "Palm Meadows · Stop 01", time: "7:30 AM", tone: "green", routeId: "RTE-003" },
  { id: "ACT-6", icon: "↗", title: "Bus 08 heading to Rosewood Society", detail: "Next stop · approx. 4 min away", time: "7:43 AM", tone: "blue", routeId: "RTE-008" },
];

const globalStore = globalThis as typeof globalThis & {
  waypointTransportState?: TransportState;
};

export function getTransportState(): TransportState {
  if (!globalStore.waypointTransportState) {
    globalStore.waypointTransportState = {
      routes: JSON.parse(JSON.stringify(defaultRoutes)),
      students: JSON.parse(JSON.stringify(defaultStudents)),
      notifications: JSON.parse(JSON.stringify(defaultNotifications)),
      activity: JSON.parse(JSON.stringify(defaultActivity)),
    };
  }
  return globalStore.waypointTransportState;
}

export function getCurrentTimeStr(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
