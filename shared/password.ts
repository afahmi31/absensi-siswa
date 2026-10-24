export const passwordFields = ['currentPassword', 'newPassword', 'confirmation'] as const
export function passwordErrors(body: Record<string, unknown>): Record<string, string> {
  const errors: Record<string,string> = {}
  if (typeof body.currentPassword !== 'string' || !body.currentPassword || body.currentPassword.length > 1024) errors.currentPassword = 'Masukkan kata sandi saat ini.'
  if (typeof body.newPassword !== 'string' || body.newPassword.length < 12 || body.newPassword.length > 1024) errors.newPassword = 'Kata sandi baru harus 12 sampai 1024 karakter.'
  else if (body.newPassword === body.currentPassword) errors.newPassword = 'Gunakan kata sandi baru yang berbeda.'
  if (typeof body.confirmation !== 'string' || body.confirmation !== body.newPassword) errors.confirmation = 'Konfirmasi kata sandi belum sama.'
  return errors
}
