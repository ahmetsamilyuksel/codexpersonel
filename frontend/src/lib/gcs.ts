import { Storage } from '@google-cloud/storage'
import crypto from 'crypto'

let storage: Storage | null = null

function getStorage(): Storage {
  if (!storage) {
    const projectId = process.env.GCS_PROJECT_ID
    const clientEmail = process.env.GCS_CLIENT_EMAIL
    const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('GCS credentials not configured. Set GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY in environment.')
    }

    storage = new Storage({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    })
  }
  return storage
}

function getBucket() {
  const bucketName = process.env.GCS_BUCKET_NAME
  if (!bucketName) throw new Error('GCS_BUCKET_NAME not configured')
  return getStorage().bucket(bucketName)
}

export async function uploadFile(
  buffer: Buffer,
  path: string,
  mimeType: string
): Promise<{ storagePath: string; storageHash: string; size: number }> {
  const bucket = getBucket()
  const file = bucket.file(path)

  const hash = crypto.createHash('md5').update(buffer).digest('hex')

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: { hash },
    },
    resumable: false,
  })

  return {
    storagePath: path,
    storageHash: hash,
    size: buffer.length,
  }
}

export async function getSignedUrl(path: string, expiresInMinutes = 60): Promise<string> {
  const bucket = getBucket()
  const file = bucket.file(path)

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  })

  return url
}

export async function deleteFile(path: string): Promise<void> {
  const bucket = getBucket()
  const file = bucket.file(path)
  await file.delete({ ignoreNotFound: true })
}

export function buildStoragePath(
  employeeNo: string,
  documentType: string,
  fileName: string
): string {
  const year = new Date().getFullYear().toString()
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `personel/${employeeNo}/${documentType}/${year}/${sanitized}`
}

export function isGcsConfigured(): boolean {
  return !!(
    process.env.GCS_PROJECT_ID &&
    process.env.GCS_CLIENT_EMAIL &&
    process.env.GCS_PRIVATE_KEY &&
    process.env.GCS_BUCKET_NAME
  )
}
