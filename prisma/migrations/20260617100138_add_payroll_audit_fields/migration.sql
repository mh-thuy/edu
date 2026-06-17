-- AlterTable
ALTER TABLE "teacher_payrolls" ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "paid_by" TEXT;

-- AddForeignKey
ALTER TABLE "teacher_payrolls" ADD CONSTRAINT "teacher_payrolls_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
