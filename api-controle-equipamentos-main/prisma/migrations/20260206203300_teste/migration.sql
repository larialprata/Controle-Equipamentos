-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('checkin', 'checkout');

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_operations" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "operation_type" "OperationType" NOT NULL,
    "horimeter" DECIMAL(10,2) NOT NULL,
    "photo_url" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "observation" TEXT,
    "operation_datetime" TIMESTAMP(3) NOT NULL,
    "synced" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_operations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_operations" ADD CONSTRAINT "check_operations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_operations" ADD CONSTRAINT "check_operations_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
