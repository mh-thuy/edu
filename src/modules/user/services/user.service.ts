import bcrypt from "bcrypt";
import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { UserCreate, UserFilter, UserUpdate } from "../schemas/user.schema";

function withoutPassword<T extends { passwordHash: string }>(user: T) {
  const { passwordHash, ...safeUser } = user;
  void passwordHash;
  return safeUser;
}

export async function getUsers(filter: UserFilter) {
  const { search, status, page, pageSize } = filter;
  const where: Prisma.UserWhereInput = {
    ...(search && {
      OR: [
        { email: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && { status }),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items: users.map(withoutPassword),
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function createUser(data: UserCreate) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      fullName: data.fullName,
      passwordHash,
      status: data.status,
    },
  });
  return withoutPassword(user);
}

export async function updateUser(id: string, data: UserUpdate, actorId: string) {
  if (id === actorId && data.status && data.status !== "ACTIVE") {
    throw new ConflictError("Không thể khóa tài khoản đang đăng nhập");
  }
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("Không tìm thấy người dùng");
  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        email: data.email?.toLowerCase(),
        fullName: data.fullName,
        passwordHash,
        status: data.status,
        deletedAt:
          data.status === "ACTIVE"
            ? null
            : data.status === "INACTIVE"
              ? new Date()
              : undefined,
      },
    });
    return withoutPassword(updated);
  });
}

export async function deactivateUser(id: string, actorId: string) {
  if (id === actorId) throw new ConflictError("Không thể khóa tài khoản đang đăng nhập");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Không tìm thấy người dùng");
  const updated = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE, deletedAt: new Date() },
  });
  return withoutPassword(updated);
}
