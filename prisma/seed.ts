import { PrismaClient, Role, DeviceStatus, AuditAction } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // --- Login accounts (one per role, for testing auth/RBAC in Phase 2) ---
  const users = [
    { username: "it_admin", fullName: "IT Admin", role: Role.IT, password: "password123" },
    { username: "hr_user", fullName: "HR User", role: Role.HR, password: "password123" },
    { username: "finance_user", fullName: "Finance User", role: Role.FINANCE, password: "password123" },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        passwordHash,
      },
    });
  }

  // --- Reference data ---
  const locations = await Promise.all(
    [
      { center: "Back Office", department: "Phòng Tổ chức Hành chính" },
      { center: "Back Office", department: "Phòng Công nghệ và Đổi mới sáng tạo" },
      { center: "Lãnh đạo Công ty", department: "Phòng Cung ứng vận hành" },
    ].map((loc) =>
      prisma.location.upsert({
        where: { center_department: { center: loc.center, department: loc.department } },
        update: {},
        create: loc,
      })
    )
  );

  const deviceTypeDefs = [
    { name: "Laptop", hasSpecs: true },
    { name: "PC", hasSpecs: true },
    { name: "Monitor", hasSpecs: false },
    { name: "Mobile Device", hasSpecs: false },
    { name: "Scanner", hasSpecs: false },
  ];
  const deviceTypes = await Promise.all(
    deviceTypeDefs.map((dt) =>
      prisma.deviceType.upsert({
        where: { name: dt.name },
        update: { hasSpecs: dt.hasSpecs },
        create: dt,
      })
    )
  );

  const employees = await Promise.all(
    [
      { employeeId: "000000", fullName: "Unassigned", email: null, locationId: null },
      { employeeId: "EMP001", fullName: "Nguyen Van A", email: "a.nguyen@vnpost.vn", locationId: locations[0].id },
      { employeeId: "EMP002", fullName: "Tran Thi B", email: "b.tran@vnpost.vn", locationId: locations[1].id },
    ].map((e) =>
      prisma.employee.upsert({
        where: { employeeId: e.employeeId },
        update: {},
        create: e,
      })
    )
  );

  // --- A few dummy devices, one per status, for testing the dashboard/list/filters ---
  const dummyDevices = [
    { assetId: "DEMO-LAP001", deviceTypeId: deviceTypes[0].id, makeModel: "Dell Vostro 3400", serialNumber: "SN0001", status: DeviceStatus.IN_STOCK, locationId: locations[0].id, assignedUserId: null, assignedUserEmail: null },
    { assetId: "DEMO-PC001", deviceTypeId: deviceTypes[1].id, makeModel: "Dell Inspiron 3670", serialNumber: "SN0002", status: DeviceStatus.DEPLOYED, locationId: locations[1].id, assignedUserId: employees[1].id, assignedUserEmail: employees[1].email },
    { assetId: "DEMO-MH001", deviceTypeId: deviceTypes[2].id, makeModel: "Dell 22-inch Monitor", serialNumber: "SN0003", status: DeviceStatus.IN_REPAIR, locationId: locations[1].id, assignedUserId: employees[2].id, assignedUserEmail: employees[2].email },
    { assetId: "DEMO-MB001", deviceTypeId: deviceTypes[3].id, makeModel: "Samsung Galaxy A54", serialNumber: "SN0004", status: DeviceStatus.LOST, locationId: locations[2].id, assignedUserId: null, assignedUserEmail: null },
    { assetId: "DEMO-SC001", deviceTypeId: deviceTypes[4].id, makeModel: "Honeywell Scanner", serialNumber: "SN0005", status: DeviceStatus.RETIRED, locationId: locations[0].id, assignedUserId: null, assignedUserEmail: null },
  ];

  for (const d of dummyDevices) {
    const device = await prisma.device.upsert({
      where: { assetId: d.assetId },
      update: {},
      create: d,
    });

    const existingLog = await prisma.auditLog.findFirst({ where: { assetId: device.assetId } });
    if (!existingLog) {
      await prisma.auditLog.create({
        data: {
          assetId: device.assetId,
          action: AuditAction.INITIAL_REGISTRATION,
          previousState: "N/A - New Asset",
          newState: `${d.status} @ seed data`,
          operator: "seed-script",
          reason: null,
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
