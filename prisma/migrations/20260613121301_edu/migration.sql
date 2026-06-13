/*
  Warnings:

  - The primary key for the `class_schedules` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `class_students` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `classes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `rooms` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `students` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `teachers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "class_schedules" DROP CONSTRAINT "class_schedules_class_id_fkey";

-- DropForeignKey
ALTER TABLE "class_schedules" DROP CONSTRAINT "class_schedules_room_id_fkey";

-- DropForeignKey
ALTER TABLE "class_students" DROP CONSTRAINT "class_students_class_id_fkey";

-- DropForeignKey
ALTER TABLE "class_students" DROP CONSTRAINT "class_students_student_id_fkey";

-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_room_id_fkey";

-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "teachers" DROP CONSTRAINT "teachers_user_id_fkey";

-- DropIndex
DROP INDEX "class_schedules_class_id_idx";

-- DropIndex
DROP INDEX "class_schedules_room_id_idx";

-- DropIndex
DROP INDEX "classes_room_id_idx";

-- DropIndex
DROP INDEX "classes_teacher_id_idx";

-- AlterTable
ALTER TABLE "class_schedules" DROP CONSTRAINT "class_schedules_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "class_id" SET DATA TYPE TEXT,
ALTER COLUMN "room_id" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "class_students" DROP CONSTRAINT "class_students_pkey",
ALTER COLUMN "class_id" SET DATA TYPE TEXT,
ALTER COLUMN "student_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "class_students_pkey" PRIMARY KEY ("class_id", "student_id");

-- AlterTable
ALTER TABLE "classes" DROP CONSTRAINT "classes_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "teacher_id" SET DATA TYPE TEXT,
ALTER COLUMN "room_id" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "students" DROP CONSTRAINT "students_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "teachers" DROP CONSTRAINT "teachers_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "teachers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
