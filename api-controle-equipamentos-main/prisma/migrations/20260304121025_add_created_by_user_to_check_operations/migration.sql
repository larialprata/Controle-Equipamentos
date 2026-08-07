-- AlterTable
ALTER TABLE "check_operations" ADD COLUMN     "created_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "check_operations" ADD CONSTRAINT "check_operations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
