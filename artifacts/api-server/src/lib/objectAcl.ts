/**
 * objectAcl.ts — Stub de ACL para Cloudinary.
 *
 * Cloudinary maneja el control de acceso por su propia configuración
 * (delivery types: upload, private, authenticated, etc.).
 * Este archivo se mantiene por compatibilidad con el flujo actual.
 */

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<{ type: string; id: string; permission: ObjectPermission }>;
}

export async function setObjectAclPolicy(): Promise<void> {
  // No-op: Cloudinary maneja ACL por su propia config
}

export async function getObjectAclPolicy(): Promise<ObjectAclPolicy | null> {
  return null;
}

export async function canAccessObject(): Promise<boolean> {
  return true;
}
