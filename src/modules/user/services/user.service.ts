import bcrypt from "bcrypt";
import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { UserCreate, UserFilter, UserUpdate } from "../schemas/user.schema";

const safeUserInclude = {
  roles: { include: { role: { select: { id: true, code: true, name: true } } } },
};

function withoutPassword<T extends { passwordHash: string }>(user: T) {
  const { passwordHash, ...safeUser } = user;
  void passwordHash;
  return safeUser;
}

export async function getRoles() {
  return prisma.role.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, description: true },
    orderBy: { code: "asc" },
  });
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
      include: safeUserInclude,
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
  };
}

export async function createUser(data: UserCreate) {
  const roles = await prisma.role.findMany({
    where: { id: { in: data.roleIds }, isActive: true },
    select: { id: true },
  });
  if (roles.length !== new Set(data.roleIds).size) {
    throw new ConflictError("Một hoặc nhiều role không hợp lệ");
  }
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      fullName: data.fullName,
      passwordHash,
      status: data.status,
      roles: { create: data.roleIds.map((roleId) => ({ roleId })) },
    },
    include: safeUserInclude,
  });
  return withoutPassword(user);
}

export async function updateUser(id: string, data: UserUpdate, actorId: string) {
  if (id === actorId && data.status && data.status !== "ACTIVE") {
    throw new ConflictError("Không thể khóa tài khoản đang đăng nhập");
  }
  const current = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
  if (!current) throw new NotFoundError("Không tìm thấy người dùng");
  const roleIds = data.roleIds ?? current.roles.map((item) => item.roleId);
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, isActive: true },
    select: { id: true },
  });
  if (roles.length !== new Set(roleIds).size) throw new ConflictError("Một hoặc nhiều role không hợp lệ");
  if (data.status && data.status !== "ACTIVE" && roleIds.length === 0) {
    throw new ConflictError("Người dùng phải có ít nhất một role");
  }
  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;
  return prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: id } });
    const updated = await tx.user.update({
      where: { id },
      data: {
        email: data.email?.toLowerCase(),
        fullName: data.fullName,
        passwordHash,
        status: data.status,
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
      include: safeUserInclude,
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
    include: safeUserInclude,
  });
  return withoutPassword(updated);
}
