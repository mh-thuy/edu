-- AlterTable
ALTER TABLE "student_fees" ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "student_fees" ADD COLUMN "note" TEXT;
