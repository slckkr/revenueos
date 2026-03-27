import CryptoJS from 'crypto-js'
import { env } from '../config/env'

class CryptoService {
  private readonly key: string

  constructor() {
    this.key = env.ENCRYPTION_KEY
  }

  encrypt(plaintext: string): string {
    return CryptoJS.AES.encrypt(plaintext, this.key).toString()
  }

  decrypt(ciphertext: string): string {
    const bytes = CryptoJS.AES.decrypt(ciphertext, this.key)
    return bytes.toString(CryptoJS.enc.Utf8)
  }
}

export const cryptoService = new CryptoService()
