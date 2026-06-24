import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.redirect(new URL('/a/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3041'))
  res.cookies.delete('ping_token')
  return res
}
