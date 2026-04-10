import * as forge from 'node-forge'
import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

const certCache = new Map<string, { key: string; cert: string }>()

const CA_CERT_FILE = 'ca-cert.pem'
const CA_KEY_FILE = 'ca-key.pem'

let caCertPem: string | null = null
let caKeyPem: string | null = null

function getCaPath(filename: string): string {
  return join(app.getPath('userData'), filename)
}

export function initCa(): { cert: string; key: string } {
  const certPath = getCaPath(CA_CERT_FILE)
  const keyPath = getCaPath(CA_KEY_FILE)

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    caCertPem = fs.readFileSync(certPath, 'utf-8')
    caKeyPem = fs.readFileSync(keyPath, 'utf-8')
    console.log('[Cert] CA 根证书已从本地加载')
    return { cert: caCertPem, key: caKeyPem }
  }

  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  const now = new Date()
  cert.validity.notBefore = now
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(now.getFullYear() + 60)

  const attrs = [
    { name: 'commonName', value: 'CC Look CA' },
    { name: 'countryName', value: 'CN' },
    { shortName: 'O', value: 'CC Look' }
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)

  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      crlSign: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true
    }
  ])

  cert.sign(keys.privateKey, forge.md.sha256.create())

  caCertPem = forge.pki.certificateToPem(cert)
  caKeyPem = forge.pki.privateKeyToPem(keys.privateKey)

  fs.writeFileSync(certPath, caCertPem)
  fs.writeFileSync(keyPath, caKeyPem, { mode: 0o600 })

  console.log('[Cert] CA 根证书已生成并保存到', app.getPath('userData'))
  return { cert: caCertPem, key: caKeyPem }
}

export function getCaCertPem(): string {
  if (!caCertPem) {
    initCa()
  }
  return caCertPem!
}

export function getOrGenerateCert(hostname: string): { key: string; cert: string } {
  if (!caCertPem || !caKeyPem) {
    initCa()
  }

  if (certCache.has(hostname)) {
    return certCache.get(hostname)!
  }

  const caCert = forge.pki.certificateFromPem(caCertPem!)
  const caKey = forge.pki.privateKeyFromPem(caKeyPem!)

  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = Math.floor(Math.random() * 100000).toString(16)

  const now = new Date()
  cert.validity.notBefore = now
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(now.getFullYear() + 1)

  cert.setSubject([{ name: 'commonName', value: hostname }])
  cert.setIssuer(caCert.subject.attributes as any)

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true
    },
    {
      name: 'subjectAltName',
      altNames: [{ type: 2, value: hostname }]
    }
  ])

  cert.sign(caKey, forge.md.sha256.create())

  const result = {
    key: forge.pki.privateKeyToPem(keys.privateKey),
    cert: forge.pki.certificateToPem(cert)
  }

  certCache.set(hostname, result)
  return result
}
