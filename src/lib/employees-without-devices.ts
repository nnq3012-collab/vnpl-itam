import { EmployeeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Active employees with no device linked at all, optionally limited to one
 * Center. Shared by the dashboard card and its export so they always match. */
export function getEmployeesWithoutDevices(center?: string) {
  return prisma.employee.findMany({
    where: { status: EmployeeStatus.ACTIVE, devices: { none: {} }, ...(center ? { location: { center } } : {}) },
    include: { location: true },
    orderBy: { fullName: "asc" },
  });
}
