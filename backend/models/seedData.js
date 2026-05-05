const students = [
  {
    id: "student_101",
    name: "Jitender Chauhan",
    rollNo: "GF202347445",
    className: "BCA AI ML",
    email: "jc504709@gmail.com",
    phone: "8219765794"
  },
  {
    id: "student_102",
    name: "Diya Patel",
    rollNo: "SSMS-002",
    className: "12-A",
    email: "diya.patel@schoolmail.com",
    phone: "9876501002"
  },
  {
    id: "student_103",
    name: "Kabir Singh",
    rollNo: "SSMS-003",
    className: "11-B",
    email: "kabir.singh@schoolmail.com",
    phone: "9876501003"
  },
  {
    id: "student_104",
    name: "Meera Iyer",
    rollNo: "SSMS-004",
    className: "11-B",
    email: "meera.iyer@schoolmail.com",
    phone: "9876501004"
  },
  {
    id: "student_105",
    name: "Rohan Verma",
    rollNo: "SSMS-005",
    className: "10-C",
    email: "rohan.verma@schoolmail.com",
    phone: "9876501005"
  },
  {
    id: "student_106",
    name: "Sana Khan",
    rollNo: "SSMS-006",
    className: "10-C",
    email: "sana.khan@schoolmail.com",
    phone: "9876501006"
  }
];

const users = [
  {
    id: "user_admin",
    name: "SSMS Admin",
    email: "admin@ssmspro.com",
    password: "admin123",
    role: "Admin",
    phone: "9876500000",
    theme: "light",
    subjects: [],
    assignedClassNames: [],
    assignedStudentIds: []
  },
  {
    id: "user_teacher",
    name: "Ananya Mehta",
    email: "teacher@ssmspro.com",
    password: "teacher123",
    role: "Teacher",
    phone: "9876500001",
    theme: "light",
    subjects: ["Mathematics", "Science", "Computer"],
    assignedClassNames: ["12-A", "11-B"],
    assignedStudentIds: []
  },
  {
    id: "user_student",
    name: "Jitender Chauhan",
    email: "jc504709@gmail.com",
    password: "jitender123",
    role: "Student",
    phone: "8219765794",
    theme: "light",
    studentId: "student_101",
    subjects: [],
    assignedClassNames: [],
    assignedStudentIds: []
  }
];

const subjects = ["Mathematics", "Science", "English", "Computer", "History"];
const attendanceDates = [
  "2026-04-01",
  "2026-04-02",
  "2026-04-03",
  "2026-04-04",
  "2026-04-05"
];

const attendanceMatrix = {
  student_101: ["present", "present", "present", "absent", "present"],
  student_102: ["present", "present", "absent", "present", "present"],
  student_103: ["absent", "present", "present", "present", "present"],
  student_104: ["present", "absent", "present", "present", "present"],
  student_105: ["present", "present", "present", "present", "present"],
  student_106: ["present", "absent", "absent", "present", "present"]
};

const scoreMatrix = {
  student_101: {
    Mathematics: 92,
    Science: 88,
    English: 81,
    Computer: 95,
    History: 78
  },
  student_102: {
    Mathematics: 86,
    Science: 90,
    English: 84,
    Computer: 88,
    History: 82
  },
  student_103: {
    Mathematics: 72,
    Science: 69,
    English: 75,
    Computer: 80,
    History: 74
  },
  student_104: {
    Mathematics: 91,
    Science: 87,
    English: 89,
    Computer: 90,
    History: 85
  },
  student_105: {
    Mathematics: 66,
    Science: 62,
    English: 71,
    Computer: 68,
    History: 64
  },
  student_106: {
    Mathematics: 58,
    Science: 61,
    English: 64,
    Computer: 59,
    History: 63
  }
};

const marks = students.flatMap((student) =>
  subjects.map((subject) => ({
    id: `mark_${student.id}_${subject.toLowerCase()}`,
    studentId: student.id,
    subject,
    score: scoreMatrix[student.id][subject],
    examType: "Term Assessment"
  }))
);

const attendance = students.flatMap((student) =>
  attendanceDates.map((date, index) => ({
    id: `attendance_${student.id}_${date}`,
    studentId: student.id,
    date,
    status: attendanceMatrix[student.id][index]
  }))
);

const tasks = [
  {
    id: "task_1",
    title: "Prepare monthly academic summary",
    dueDate: "2026-04-10",
    priority: "High",
    completed: false
  },
  {
    id: "task_2",
    title: "Review attendance exceptions",
    dueDate: "2026-04-11",
    priority: "Medium",
    completed: true
  },
  {
    id: "task_3",
    title: "Call parents for counseling follow-up",
    dueDate: "2026-04-12",
    priority: "High",
    completed: false
  }
];

const logs = [
  {
    id: "log_1",
    action: "Attendance Updated",
    entityType: "attendance",
    entityId: "attendance_student_101_2026-04-05",
    title: "Attendance marked present",
    description: "Aarav Sharma was marked present for 5 Apr 2026.",
    actorId: "user_teacher",
    actorName: "Ananya Mehta",
    actorRole: "Teacher",
    relatedStudentId: "student_101",
    relatedUserId: "user_teacher",
    createdAt: "2026-04-05T08:45:00.000Z"
  },
  {
    id: "log_2",
    action: "Marks Updated",
    entityType: "marks",
    entityId: "mark_student_104_mathematics",
    title: "Marks entered for Mathematics",
    description: "Meera Iyer received 91 in Mathematics.",
    actorId: "user_teacher",
    actorName: "Ananya Mehta",
    actorRole: "Teacher",
    relatedStudentId: "student_104",
    relatedUserId: "user_teacher",
    createdAt: "2026-04-06T09:20:00.000Z"
  },
  {
    id: "log_3",
    action: "Task Activity",
    entityType: "tasks",
    entityId: "task_1",
    title: "Monthly academic summary scheduled",
    description: "Prepare monthly academic summary was created with High priority.",
    actorId: "user_admin",
    actorName: "SSMS Admin",
    actorRole: "Admin",
    relatedStudentId: "",
    relatedUserId: "user_admin",
    createdAt: "2026-04-07T07:30:00.000Z"
  }
];

const messages = [
  {
    id: "message_1",
    senderId: "user_teacher",
    senderName: "Ananya Mehta",
    senderRole: "Teacher",
    recipientId: "user_student",
    recipientName: "Aarav Sharma",
    recipientRole: "Student",
    subject: "Weekly progress check",
    content: "Great improvement in Computer and Science. Keep your revision pace steady.",
    createdAt: "2026-04-08T06:15:00.000Z"
  },
  {
    id: "message_2",
    senderId: "user_student",
    senderName: "Aarav Sharma",
    senderRole: "Student",
    recipientId: "user_teacher",
    recipientName: "Ananya Mehta",
    recipientRole: "Teacher",
    subject: "Attendance clarification",
    content: "I was present on 4 Apr after the assembly session. Could you please review it?",
    createdAt: "2026-04-08T11:40:00.000Z"
  }
];

const defaultData = {
  users,
  students,
  attendance,
  marks,
  tasks,
  logs,
  messages
};

module.exports = {
  defaultData
};
