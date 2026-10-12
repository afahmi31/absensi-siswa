declare module '#auth-utils' {
  interface User {
    id: string
    sessionVersion: number
  }

  interface SecureSessionData {
    sessionId: string
  }
}

export {}
