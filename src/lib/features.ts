import type { Role } from "@prisma/client";

/** Registry of role-gated functions that it_admin can reassign from the
 * Configuration tab. Each key's `defaultRoles` is the hardcoded fallback
 * used until an explicit FeaturePermission row overrides it — so adding a
 * row here never changes behavior by itself. */
export type FeatureDefinition = {
  key: string;
  label: string;
  description: string;
  defaultRoles: Role[];
};

export const FEATURES: FeatureDefinition[] = [
  {
    key: "devices.register",
    label: "Register Device",
    description: "Create new devices in Device Master with full details (specs, price, vendor, etc.).",
    defaultRoles: ["IT", "HR"],
  },
  {
    key: "devices.edit",
    label: "Edit Device",
    description: "Change any field of a single device in Update Device — type, specs, status, location, vendor, price, purchase year.",
    defaultRoles: ["IT"],
  },
  {
    key: "devices.assign",
    label: "Assign Device",
    description: "Change a device's Assigned User and that employee's Status in Update Device.",
    defaultRoles: ["IT", "HR"],
  },
  {
    key: "devices.maintenance",
    label: "Log Maintenance",
    description: "Record maintenance events (repair, cleaning, part replacement, ...) on a device.",
    defaultRoles: ["IT"],
  },
  {
    key: "import.devices",
    label: "Import Devices",
    description: "Bulk-import devices from an Excel/CSV file.",
    defaultRoles: ["IT"],
  },
  {
    key: "import.employees",
    label: "Import Employees",
    description: "Bulk-import the employee roster from an Excel/CSV file.",
    defaultRoles: ["IT", "HR"],
  },
  {
    key: "devices.bulkEdit",
    label: "Bulk Edit Devices",
    description: "Apply the same Status, Make/Model, Location, Vendor, Price, or Purchase Year change — or add/remove a Batch — on many selected devices at once.",
    defaultRoles: ["IT"],
  },
  {
    key: "reference.deviceTypesAndVendors",
    label: "Manage Device Types & Vendors",
    description: "Edit the Device Types and Vendors reference lists, including depreciation periods.",
    defaultRoles: ["IT"],
  },
  {
    key: "reference.employeesAndLocations",
    label: "Manage Employees & Locations",
    description: "Add, edit, or remove entries in the Employees and Locations reference lists.",
    defaultRoles: ["IT", "HR"],
  },
];

export function featureDefinition(key: string): FeatureDefinition | undefined {
  return FEATURES.find((f) => f.key === key);
}
