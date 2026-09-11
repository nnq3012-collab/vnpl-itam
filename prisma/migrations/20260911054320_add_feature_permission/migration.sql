-- CreateTable
CREATE TABLE "FeaturePermission" (
    "key" TEXT NOT NULL,
    "roles" "Role"[],

    CONSTRAINT "FeaturePermission_pkey" PRIMARY KEY ("key")
);
